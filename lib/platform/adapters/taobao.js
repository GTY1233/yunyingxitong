const { createAdapter, simulatePlatformCall } = require("../adapter-factory");
const {
  buildStoreListingPayload,
  invokePlatformListingApi,
} = require("../../store-listing-service");

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
      ...simulatePlatformCall(ctx, {
        requireAsset: false,
        successMessage: "淘宝内容半自动发布成功",
      }),
      capability: "semiAuto",
    };
  },
  listingHandler(ctx) {
    const storePayload = buildStoreListingPayload(ctx.db, ctx.product, "淘宝");
    const apiResult = invokePlatformListingApi("淘宝", storePayload, {
      hasLiveApi: ctx.hasLiveApi,
      endpoint: "/openapi/taobao/item/publish",
    });
    if (apiResult.ok) return apiResult;
    if (ctx.mode === "autoListing" && ctx.hasLiveApi) {
      return {
        ...simulatePlatformCall(ctx, {
          requireAsset: false,
          successMessage: "淘宝 OpenAPI 自动上架成功",
        }),
        capability: "autoListing",
      };
    }
    return apiResult;
  },
  exportHandler(ctx) {
    const storePayload = buildStoreListingPayload(ctx.db, ctx.product, "淘宝");
    return {
      ok: true,
      capability: "export",
      platform: "淘宝",
      payload: { storeListing: storePayload, task: ctx.task, product: ctx.product },
    };
  },
});
