const { createAdapter, simulatePlatformCall } = require("../adapter-factory");

module.exports = createAdapter({
  platform: "拼多多",
  envKey: "PDD_OPEN_API_KEY",
  capabilities: {
    export: true,
    semiAuto: true,
    autoPublish: false,
    autoListing: true,
    dataSync: false,
  },
  publishHandler(ctx) {
    return {
      ...simulatePlatformCall(ctx, {
        requireAsset: false,
        successMessage: "拼多多内容半自动发布成功",
      }),
      capability: "semiAuto",
    };
  },
  listingHandler(ctx) {
    if (ctx.mode === "autoListing" && ctx.hasLiveApi) {
      return {
        ...simulatePlatformCall(ctx, {
          requireAsset: false,
          successMessage: "拼多多 OpenAPI 自动上架成功",
        }),
        capability: "autoListing",
      };
    }
    return {
      ...simulatePlatformCall(ctx, {
        requireAsset: false,
        successMessage: "拼多多半自动上架草稿已提交",
      }),
      capability: "semiAuto",
    };
  },
});
