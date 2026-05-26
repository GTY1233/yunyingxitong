const { createAdapter, simulatePlatformCall } = require("../adapter-factory");

module.exports = createAdapter({
  platform: "小红书",
  envKey: "XHS_OPEN_API_KEY",
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
        ...simulatePlatformCall(ctx, { requireAsset: true, successMessage: "小红书 OpenAPI 自动发布成功" }),
        capability: "autoPublish",
      };
    }
    return {
      ...simulatePlatformCall(ctx, { requireAsset: true, successMessage: "小红书半自动发布成功" }),
      capability: "semiAuto",
    };
  },
  listingHandler(ctx) {
    return {
      ok: false,
      error: "小红书当前未开放自动上架 API",
      capability: "export",
      fallback: "export",
    };
  },
});
