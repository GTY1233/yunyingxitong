const { createAdapter, simulatePlatformCall } = require("../adapter-factory");

module.exports = createAdapter({
  platform: "抖音",
  envKey: "DOUYIN_OPEN_API_KEY",
  capabilities: {
    export: true,
    semiAuto: true,
    autoPublish: true,
    autoListing: false,
    dataSync: false,
  },
  publishHandler(ctx) {
    if (ctx.mode === "autoPublish" && ctx.hasLiveApi) {
      return {
        ...simulatePlatformCall(ctx, { requireAsset: true, successMessage: "抖音 OpenAPI 自动发布成功" }),
        capability: "autoPublish",
      };
    }
    return {
      ...simulatePlatformCall(ctx, { requireAsset: true, successMessage: "抖音半自动发布成功" }),
      capability: "semiAuto",
    };
  },
  listingHandler(ctx) {
    return {
      ok: false,
      error: "抖音当前未开放自动上架 API，请使用导出或手动上架",
      capability: "export",
      fallback: "export",
    };
  },
});
