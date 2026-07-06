// 上架/发布节点执行器。与生成节点同构(返回 {ok,summary}/{ok:false,error}),由 executors 分发。
// 三态:demo 假成功跑通 / manual 产人工任务包 / real 真调(暂抛待接入)。
const compliance = require("../compliance/engine");
const videoAdapter = require("../video-adapter");
const socialUploader = require("../publish/social-uploader");
const { buildPublishPayload } = require("../publish/publish-payload");
const assetRepo = require("../repositories/asset.repo");
const accountRepo = require("../repositories/account.repo");
const credentialRepo = require("../repositories/credential.repo");
const { getPrisma } = require("../repositories/client");
const { resolveRunMode } = require("../platform/run-mode");
const douyin = require("../platform/douyin/adapter");
const { buildListingPayload } = require("../platform/douyin/payload");

const READY = ["已生成", "已发布", "已加入发布"];

// 仅抖音已接;其余平台暂用抖音适配器占位(未来按平台分发)。
function adapterFor(_platform) {
  return { adapter: douyin, shopApi: "douyin_shop", publishApi: "douyin_open" };
}

// 上架完整度门槛(简版,后续可换 listing-check 全量)。
function checkCompleteness(product, assets) {
  const missing = [];
  if (!String(product.name || "").trim()) missing.push("商品名称");
  if (!(Number(product.priceCents) > 0)) missing.push("价格");
  if (!(Number(product.stock) > 0)) missing.push("库存");
  if (!String(product.sellingPoints || "").trim()) missing.push("卖点");
  if (!assets.some((a) => a.kind === "image" && READY.includes(a.status))) missing.push("商品图");
  return { ok: missing.length === 0, missing };
}

async function mappingOf(productId, platform) {
  return getPrisma().platformProductMapping.findUnique({
    where: { productId_platform: { productId, platform } },
  });
}

async function executeListingNode(product, platform) {
  const { adapter, shopApi } = adapterFor(platform);
  const assets = await assetRepo.listByProduct(product.id);

  const gate = checkCompleteness(product, assets);
  if (!gate.ok) return { ok: false, error: `商品资料不完整,缺:${gate.missing.join("、")}` };

  // 合规闸门:禁售款词/低俗词命中即拦(规则见 lib/compliance/rules.js,平台红线会变只改数据)
  const comp = compliance.checkProductForListing(product, compliance.getRules(platform));
  if (!comp.ok) return { ok: false, error: `合规拦截:${comp.message}` };

  const existing = await mappingOf(product.id, platform);
  if (existing) return { ok: true, summary: `已上架(${existing.externalProductId}),跳过` };

  const cred = await credentialRepo.getByApi(platform, shopApi);
  const mode = resolveRunMode(cred);
  const creds = mode === "real" ? await credentialRepo.getDecrypted(cred.id) : null;
  const payload = buildListingPayload(product, assets);

  let result;
  try {
    result = await adapter.createListing(payload, { mode, creds });
  } catch (e) {
    return { ok: false, error: e.message };
  }

  const prisma = getPrisma();
  await prisma.listingTask.create({
    data: {
      productId: product.id,
      platform,
      status: result.mode === "manual" ? "待人工上架" : "已上架",
      mode: result.mode,
      externalId: result.externalId || null,
      platformResponse: JSON.stringify(result.manualTask || result.response || {}),
    },
  });
  if (result.externalId) {
    await prisma.platformProductMapping.create({
      data: { productId: product.id, platform, externalProductId: result.externalId },
    });
  }

  const msg =
    result.mode === "demo"
      ? `演示上架成功(${result.externalId})`
      : result.mode === "manual"
        ? "已生成上架任务包,请按包到抖店后台人工上架"
        : `真实上架成功(${result.externalId})`;
  return { ok: true, summary: msg };
}

// 矩阵内容发布。每个账号三态:
//  real   —— social-auto-upload 已配置 + 账号有发布名 → 真发(浏览器自动化)
//  manual —— 否则产出「导出发布包」,待人工去网页版发(GET /publish-package 可取)
//  demo   —— 无生成密钥的演示环境,假成功跑通
async function executePublishNode(product, platform) {
  const authorized = await accountRepo.byRole("authorized", platform);
  const creators = await accountRepo.byRole("creator", platform);
  const targets = [...authorized, ...creators];
  if (!targets.length)
    return { ok: false, error: "没有可发布的授权号/达人号账号(请先在平台账号配置)" };

  // 组装发布载荷(视频+标题+正文+标签+封面),无视频则拦
  const payload = await buildPublishPayload(product, { requireVideo: true });
  if (!payload.ok) return { ok: false, error: payload.error };

  const demo = !videoAdapter.hasRunningHubApi(); // 无生成密钥=演示环境
  const prisma = getPrisma();
  let realOk = 0;
  let manualOk = 0;
  const failures = [];

  for (const acc of targets) {
    let status;
    let mode;
    const externalId = null;
    let failureReason = null;

    if (demo) {
      mode = "demo";
      status = "已发布";
    } else if (socialUploader.canRealPublish(platform, acc)) {
      mode = "real";
      const r = await socialUploader.publish(payload, { platform, account: acc });
      if (r.ok) {
        status = "已发布";
        realOk++;
      } else {
        status = "失败";
        failureReason = r.error;
        failures.push(`${acc.name}: ${r.error}`);
      }
    } else {
      mode = "manual";
      status = "待人工发布";
      manualOk++;
    }

    await prisma.publishTask.create({
      data: {
        productId: product.id,
        accountId: acc.id,
        platform,
        assetId: payload.videoAssetId,
        status,
        mode,
        externalId,
        failureReason,
        attachProduct: true,
      },
    });
  }

  if (demo) {
    return {
      ok: true,
      summary: `演示发布成功:${targets.length} 个账号(授权号${authorized.length}/达人号${creators.length})`,
    };
  }
  // 全失败才算节点失败;部分成功仍推进(失败的进审核中心重试)
  if (failures.length && failures.length === targets.length) {
    return { ok: false, error: `发布失败:${failures.slice(0, 3).join(";")}` };
  }
  const parts = [];
  if (realOk) parts.push(`真实发布 ${realOk} 个`);
  if (manualOk) parts.push(`${manualOk} 个待人工发布(导出包已备好)`);
  if (failures.length) parts.push(`${failures.length} 个失败`);
  return { ok: true, summary: parts.join(",") || "已处理发布" };
}

module.exports = { executeListingNode, executePublishNode, checkCompleteness };
