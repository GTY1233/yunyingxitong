// 抖店上架 payload 构造(新库商品 + 资产 → addV2 入参雏形)。
// category_leaf_id 等真实字段在 real 模式 + 拿到类目后回填(docs/13 §2.4 待实测)。
function buildListingPayload(product, assets) {
  const images = (assets || [])
    .filter((a) => a.kind === "image" && a.mediaUrl)
    .map((a) => a.mediaUrl);
  return {
    name: product.name || "",
    out_product_id: product.id, // 幂等外部编码
    category_leaf_id: "", // 待真实类目下钻回填
    price: product.priceCents ?? 0, // 分
    stock: product.stock ?? 0,
    pic: images.slice(0, 1), // 主图
    description_images: images, // 详情图
    selling_points: product.sellingPoints || "",
    specs: product.specs || "",
    commit: 1, // 提审
  };
}

module.exports = { buildListingPayload };
