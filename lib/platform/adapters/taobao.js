const { createAdapter, simulatePlatformCall } = require("../adapter-factory");

module.exports = createAdapter({
  platform: "淘宝",
  envKey: "TAOBAO_OPEN_API_KEY",
  capabilities: {
    export: true,
    semiAuto: true,
    autoPublish: false,
    autoListing: true,
    dataSync: false,
  },
  publishHandler(ctx) {
    return {
      ...simulatePlatformCall(ctx, { requireAsset: false, successMessage: "淘宝内容半自动发布成功" }),
      capability: "semiAuto",
    };
  },
  listingHandler(ctx) {
    if (ctx.mode === "autoListing" && ctx.hasLiveApi) {
      return {
        ...simulatePlatformCall(ctx, { requireAsset: false, successMessage: "淘宝 OpenAPI 自动上架成功" }),
        capability: "autoListing",
      };
    }
    return {
      ...simulatePlatformCall(ctx, { requireAsset: false, successMessage: "淘宝半自动上架草稿已提交" }),
      capability: "semiAuto",
    };
  },
});
