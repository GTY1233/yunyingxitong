const { buildExportPack } = require("./export-pack");
const { isPlatformDemoMode, demoExternalId } = require("./platform-demo");

function pickListingAssets(db, productId) {
  const pack = buildExportPack(db, productId);
  if (!pack) return { images: [], copy: null, video: null };
  return {
    images: pack.materials.images || [],
    primaryImage: pack.materials.primaryImage,
    copy: pack.materials.copy,
    video: pack.materials.video,
  };
}

function buildStoreListingPayload(db, product, platform) {
  const materials = pickListingAssets(db, product.id);
  const base = {
    platform,
    productId: product.id,
    skuCode: product.code,
    title: product.name,
    category: product.category,
    price: product.price,
    stock: product.stock,
    sellingPoints: product.sellingPoints,
    specs: product.specs,
    images: materials.images.map((item) => item.url).filter(Boolean),
    primaryImageUrl: materials.primaryImage?.url || materials.images[0]?.url || "",
    detailText: materials.copy?.content || product.sellingPoints,
    videoUrl: materials.video?.videoUrl || "",
  };

  if (platform === "抖音") {
    return {
      ...base,
      api: "douyin.shop.product",
      steps: ["product.addV2", "product.launch"],
      payload: {
        addV2: {
          name: base.title,
          category_id: "demo_category",
          pic: base.images.slice(0, 5),
          description: base.detailText,
          spec_info: base.specs,
          market_price: Math.round(base.price * 100),
          stock_num: base.stock,
        },
        launch: { product_id: "{{product_id}}", sku_stock_sync: true },
      },
    };
  }
  if (platform === "淘宝") {
    return {
      ...base,
      api: "taobao.item",
      steps: ["alibaba.item.publish"],
      payload: {
        title: base.title,
        price: base.price,
        quantity: base.stock,
        desc: base.detailText,
        image_urls: base.images,
      },
    };
  }
  if (platform === "小红书") {
    return {
      ...base,
      api: "xhs.shop.item",
      steps: ["item.create", "item.online"],
      payload: {
        name: base.title,
        price: base.price,
        stock: base.stock,
        images: base.images,
        note_style_desc: base.detailText,
      },
    };
  }
  return { ...base, api: "generic.listing", steps: ["listing.submit"], payload: base };
}

function invokePlatformListingApi(platform, storePayload, options = {}) {
  const hasKey = Boolean(options.hasLiveApi);
  const endpoint = options.endpoint || `/openapi/${platform}/listing/submit`;

  if (isPlatformDemoMode() && !hasKey) {
    const productId = demoExternalId(platform, "PID");
    return {
      ok: true,
      demoMode: true,
      capability: "demoApi",
      externalId: productId,
      message: `[演示] ${platform} 上架接口已调用（${storePayload.steps?.join(" → ") || "submit"}）`,
      response: {
        endpoint,
        steps: storePayload.steps,
        product_id: productId,
        launched: true,
        syncedAt: new Date().toISOString(),
      },
    };
  }

  if (!hasKey) {
    return {
      ok: false,
      error: `${platform} 未配置 OpenAPI 密钥，已保留上架载荷可导出`,
      capability: "export",
      fallback: "export",
      payload: storePayload,
    };
  }

  return {
    ok: true,
    capability: "autoListing",
    externalId: demoExternalId(platform, "LIVE"),
    message: `${platform} OpenAPI 上架已提交（联调占位）`,
    response: { endpoint, accepted: true },
  };
}

module.exports = {
  buildStoreListingPayload,
  invokePlatformListingApi,
  pickListingAssets,
};
