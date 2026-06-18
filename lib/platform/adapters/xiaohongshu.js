const { createAdapter, simulatePlatformCall } = require("../adapter-factory");
const {
  buildStoreListingPayload,
  invokePlatformListingApi,
} = require("../../store-listing-service");

module.exports = createAdapter({
  platform: "小红书",
  envKey: "XHS_OPEN_API_KEY",
  capabilities: {
    export: true,
    semiAuto: true,
    autoPublish: true,
    autoListing: true,
    dataSync: false,
  },
  publishHandler(ctx) {
    if (ctx.mode === "autoPublish" && ctx.hasLiveApi) {
      return {
        ...simulatePlatformCall(ctx, {
          requireAsset: true,
          successMessage: "小红书 OpenAPI 自动发布成功",
          capability: "autoPublish",
          externalPrefix: "PUB",
        }),
        capability: "autoPublish",
      };
    }
    return {
      ...simulatePlatformCall(ctx, {
        requireAsset: true,
        successMessage: "小红书半自动发布成功（接口已提交）",
        capability: "semiAuto",
        externalPrefix: "PUB",
      }),
      capability: "semiAuto",
    };
  },
  listingHandler(ctx) {
    const storePayload = buildStoreListingPayload(ctx.db, ctx.product, "小红书");
    return invokePlatformListingApi("小红书", storePayload, {
      hasLiveApi: ctx.hasLiveApi,
      endpoint: "/openapi/xhs/shop/item/create+online",
    });
  },
  exportHandler(ctx) {
    const storePayload = buildStoreListingPayload(ctx.db, ctx.product, "小红书");
    return {
      ok: true,
      capability: "export",
      platform: "小红书",
      payload: { storeListing: storePayload, task: ctx.task, product: ctx.product },
    };
  },
});
