const { createAdapter, simulatePlatformCall } = require("../adapter-factory");
const { buildStoreListingPayload, invokePlatformListingApi } = require("../../store-listing-service");

module.exports = createAdapter({
  platform: "抖音",
  envKey: "DOUYIN_OPEN_API_KEY",
  capabilities: {
    export: true,
    semiAuto: true,
    autoPublish: true,
    autoListing: true,
    dataSync: true,
  },
  publishHandler(ctx) {
    if (ctx.mode === "autoPublish" && ctx.hasLiveApi) {
      return {
        ...simulatePlatformCall(ctx, {
          requireAsset: true,
          successMessage: "抖音 OpenAPI 视频发布成功",
          capability: "autoPublish",
          externalPrefix: "PUB",
        }),
        capability: "autoPublish",
      };
    }
    return {
      ...simulatePlatformCall(ctx, {
        requireAsset: true,
        successMessage: "抖音半自动发布成功（接口已提交）",
        capability: "semiAuto",
        externalPrefix: "PUB",
      }),
      capability: "semiAuto",
    };
  },
  listingHandler(ctx) {
    const storePayload = buildStoreListingPayload(ctx.db, ctx.product, "抖音");
    return invokePlatformListingApi("抖音", storePayload, {
      hasLiveApi: ctx.hasLiveApi,
      endpoint: "/openapi/douyin/shop/product/addV2+launch",
    });
  },
  exportHandler(ctx) {
    const storePayload = buildStoreListingPayload(ctx.db, ctx.product, "抖音");
    return {
      ok: true,
      capability: "export",
      platform: "抖音",
      payload: {
        mode: "导出手动上架",
        storeListing: storePayload,
        task: ctx.task,
        product: ctx.product,
        account: ctx.account,
      },
    };
  },
});
