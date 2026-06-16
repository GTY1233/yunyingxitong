// 节点执行器:把 generate 节点接到真实生成适配器,产物存成 Asset。
// 当前:文案(copy)接真实 DeepSeek(无密钥则模板兜底);图片/视频需先有商品原图,暂演示。
const copyAdapter = require("../copy-adapter");
const assetRepo = require("../repositories/asset.repo");

function safeParse(s, fallback) {
  if (!s) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

// 新库商品 → 旧适配器期望的形状(priceCents→元、platforms JSON→数组)。
function adaptProduct(p) {
  const platforms = safeParse(p.platforms, []);
  return {
    id: p.id,
    name: p.name || "",
    category: p.category || "",
    price: (p.priceCents ?? 0) / 100,
    sellingPoints: p.sellingPoints || "",
    specs: p.specs || "",
    platforms,
  };
}

// 执行一个 generate 节点。返回 { ok, assetIds?, summary } 或 { ok:false, error }。
async function executeGenerateNode(node, product) {
  if (!product) return { ok: false, error: "商品不存在" };
  const meta = safeParse(node.meta, {});
  const params = meta.params || {};

  if (node.kind === "copy") {
    const adapted = adaptProduct(product);
    const result = await copyAdapter.generateCopy(adapted, {
      copyType: params.copyType || "发布文案",
      platform: adapted.platforms[0] || "抖音",
      versionCount: 3,
    });
    const assetIds = [];
    for (let i = 0; i < result.versions.length; i++) {
      const asset = await assetRepo.create({
        productId: product.id,
        kind: "copy",
        type: result.copyType,
        name: `${result.copyType} ${i + 1}`,
        status: "已生成",
        usage: "成品库",
        provider: result.provider,
        content: result.versions[i],
      });
      assetIds.push(asset.id);
    }
    return {
      ok: true,
      assetIds,
      summary: `${result.provider} 生成 ${result.versions.length} 条「${result.copyType}」`,
    };
  }

  // 图片/视频:真实生成需商品原图上传(后续子步);上架/发布需平台 API。暂演示成功。
  return { ok: true, demo: true, summary: "演示执行(真实生成待接入原图上传 / 平台 API)" };
}

module.exports = { executeGenerateNode };
