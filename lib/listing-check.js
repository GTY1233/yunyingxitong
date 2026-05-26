function productAssets(db, productId) {
  return (db.assets || []).filter((item) => item.productId === productId);
}

function computeListingCompleteness(db, productId) {
  const product = (db.products || []).find((item) => item.id === productId);
  if (!product) {
    return { completeness: 0, missing: ["商品不存在"], checks: [] };
  }

  const assets = productAssets(db, productId);
  const hasPrimary = assets.some((item) => item.kind === "image" && item.isPrimary && item.status === "已生成");
  const hasImage = assets.some((item) => item.kind === "image" && item.status === "已生成");
  const hasCopy = assets.some((item) => item.kind === "copy" && item.status === "已生成");

  const checks = [
    { key: "name", label: "商品名称", ok: Boolean(String(product.name || "").trim()) },
    { key: "category", label: "商品类目", ok: Boolean(String(product.category || "").trim()) && product.category !== "待识别" },
    { key: "price", label: "商品价格", ok: Number(product.price) > 0 },
    { key: "stock", label: "可售库存", ok: Number(product.stock) > 0 },
    { key: "sellingPoints", label: "核心卖点", ok: Boolean(String(product.sellingPoints || "").trim()) && !String(product.sellingPoints).includes("待补充") },
    { key: "specs", label: "规格参数", ok: Boolean(String(product.specs || "").trim()) && product.specs !== "待补充" },
    { key: "platform", label: "目标平台", ok: Array.isArray(product.platforms) && product.platforms.length > 0 && product.platforms[0] !== "待选择" },
    { key: "image", label: "商品图片", ok: hasImage || product.imageStatus === "已生成" },
    { key: "primaryImage", label: "主图设置", ok: hasPrimary },
    { key: "copy", label: "发布文案", ok: hasCopy || product.copyStatus === "已生成" },
  ];

  const passed = checks.filter((item) => item.ok).length;
  const missing = checks.filter((item) => !item.ok).map((item) => item.label);

  return {
    completeness: Math.round((passed / checks.length) * 100),
    missing,
    checks,
    blocked: product.stock === 0,
  };
}

module.exports = {
  computeListingCompleteness,
};
