function pickPrimaryImage(assets) {
  return assets.find((item) => item.kind === "image" && item.isPrimary) || assets.find((item) => item.kind === "image");
}

function pickLatestCopy(assets) {
  return assets.find((item) => item.kind === "copy" && item.status === "已生成");
}

function pickLatestVideo(assets) {
  return assets.find((item) => item.kind === "video" && item.status === "已生成");
}

function buildExportPack(db, productId) {
  const product = (db.products || []).find((item) => item.id === productId);
  if (!product) return null;

  const assets = (db.assets || []).filter((item) => item.productId === productId);
  const primaryImage = pickPrimaryImage(assets);
  const copyAsset = pickLatestCopy(assets);
  const videoAsset = pickLatestVideo(assets);
  const images = assets.filter((item) => item.kind === "image" && item.status === "已生成");

  return {
    exportedAt: new Date().toISOString(),
    product: {
      id: product.id,
      name: product.name,
      code: product.code,
      category: product.category,
      price: product.price,
      stock: product.stock,
      sellingPoints: product.sellingPoints,
      specs: product.specs,
      platforms: product.platforms,
      accounts: product.accounts,
    },
    materials: {
      primaryImage: primaryImage
        ? { id: primaryImage.id, name: primaryImage.name, url: primaryImage.imageUrl || "", isPrimary: Boolean(primaryImage.isPrimary) }
        : null,
      images: images.map((item) => ({ id: item.id, name: item.name, url: item.imageUrl || "", type: item.type })),
      copy: copyAsset
        ? { id: copyAsset.id, name: copyAsset.name, content: copyAsset.content || "", type: copyAsset.type }
        : null,
      video: videoAsset
        ? {
            id: videoAsset.id,
            name: videoAsset.name,
            videoUrl: videoAsset.videoUrl || "",
            posterUrl: videoAsset.posterUrl || "",
            script: videoAsset.content || "",
          }
        : null,
    },
    note: "M6 素材包：JSON 格式，便于人工发布或后续接平台 API。",
  };
}

module.exports = {
  buildExportPack,
};
