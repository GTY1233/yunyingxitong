// 上架/发布节点执行器。与生成节点同构(返回 {ok,summary}/{ok:false,error}),由 executors 分发。
// 三态:demo 假成功跑通 / manual 产人工任务包 / real 真调(暂抛待接入)。
const compliance = require("../compliance/engine");
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

async function executePublishNode(product, platform) {
  const { adapter } = adapterFor(platform);
  const mapping = await mappingOf(product.id, platform);
  if (!mapping) return { ok: false, error: "商品尚未上架,无法发布(请先完成主店上架)" };

  const cred = await credentialRepo.getByApi(platform, "douyin_open");
  const mode = resolveRunMode(cred);

  const authorized = await accountRepo.byRole("authorized", platform);
  const creators = await accountRepo.byRole("creator", platform);
  const targets = [...authorized, ...creators];
  if (!targets.length)
    return { ok: false, error: "没有可发布的授权号/达人号账号(请先在平台账号配置)" };

  const videos = await assetRepo.listByProduct(product.id, "video");
  const video = videos[videos.length - 1] || null;

  const prisma = getPrisma();
  let manualCount = 0;
  for (const acc of targets) {
    const r = await adapter.publishVideo(
      { videoAssetId: video?.id, productExternalId: mapping.externalProductId, accountId: acc.id },
      { mode }
    );
    if (r.mode === "manual") manualCount++;
    await prisma.publishTask.create({
      data: {
        productId: product.id,
        accountId: acc.id,
        platform,
        assetId: video?.id || null,
        status: r.mode === "manual" ? "待人工发布" : "已发布",
        mode: r.mode,
        externalId: r.externalId || null,
        attachProduct: true,
      },
    });
  }

  const summary =
    mode === "demo"
      ? `演示发布成功:${targets.length} 个账号(授权号${authorized.length}/达人号${creators.length})`
      : `已生成 ${manualCount} 个发布任务包(官方挂车 API 不可得,需 RPA/人工)`;
  return { ok: true, summary };
}

module.exports = { executeListingNode, executePublishNode, checkCompleteness };
