const { isPlatformDemoMode, ensureDemoContext, demoExternalId } = require("../platform-demo");

function createAdapter(config) {
  const {
    platform,
    capabilities,
    envKey = "",
    publishHandler,
    listingHandler,
    exportHandler,
  } = config;

  function hasLiveApi() {
    return envKey ? Boolean(process.env[envKey]) : false;
  }

  function resolveMode(requestedMode) {
    if (requestedMode === "自动" && capabilities.autoPublish && hasLiveApi()) return "autoPublish";
    if (requestedMode === "自动上架" && capabilities.autoListing && hasLiveApi()) return "autoListing";
    if (capabilities.semiAuto) return "semiAuto";
    if (capabilities.export) return "export";
    return "none";
  }

  function publish(ctx) {
    const mode = resolveMode(ctx.task?.mode || ctx.mode || "半自动");
    if (mode === "none") {
      return {
        ok: false,
        error: `${platform} 当前无可用的发布能力`,
        capability: "none",
        platform,
      };
    }

    if (mode === "export") {
      return {
        ok: false,
        error: `${platform} 当前仅支持导出发布，请使用导出功能`,
        capability: "export",
        platform,
        fallback: "export",
      };
    }

    if (typeof publishHandler === "function") {
      return publishHandler({ ...ctx, mode, hasLiveApi: hasLiveApi(), platform });
    }

    return { ok: false, error: "未配置发布处理器", platform };
  }

  function listing(ctx) {
    const mode = resolveMode(ctx.task?.mode || ctx.mode || "半自动");
    if (!capabilities.autoListing && !capabilities.semiAuto && capabilities.export) {
      return {
        ok: false,
        error: `${platform} 当前仅支持导出上架草稿`,
        capability: "export",
        platform,
        fallback: "export",
      };
    }

    if (typeof listingHandler === "function") {
      return listingHandler({ ...ctx, mode, hasLiveApi: hasLiveApi(), platform });
    }

    return { ok: false, error: "未配置上架处理器", platform };
  }

  function buildExport(ctx) {
    if (typeof exportHandler === "function") return exportHandler(ctx);
    return {
      ok: true,
      capability: "export",
      platform,
      payload: {
        platform,
        exportedAt: new Date().toISOString(),
        product: ctx.product,
        task: ctx.task,
        account: ctx.account,
        asset: ctx.asset,
      },
    };
  }

  return {
    platform,
    capabilities,
    envKey,
    hasLiveApi,
    resolveMode,
    publish,
    listing,
    buildExport,
  };
}

function simulatePlatformCall(ctx, options = {}) {
  const { product, platform } = ctx;
  if (isPlatformDemoMode()) {
    ensureDemoContext(ctx);
    return {
      ok: true,
      demoMode: true,
      capability: options.capability || "demoApi",
      externalId: demoExternalId(platform, options.externalPrefix || "API"),
      message: options.successMessage || `[演示] ${platform} 接口调用成功`,
    };
  }
  const { account } = ctx;
  if (account?.auth === "授权已失效" || account?.auth === "未授权") {
    return { ok: false, error: `${platform} 账号未授权或授权已失效` };
  }
  if (product?.stock === 0) {
    return { ok: false, error: "库存为 0，平台拒绝发布/上架" };
  }
  if (account?.auth === "授权即将过期" && Math.random() < (options.expireFailRate || 0.12)) {
    return { ok: false, error: `${platform} 平台返回：授权令牌即将失效` };
  }
  if (options.requireAsset && !ctx.asset) {
    return { ok: false, error: "缺少关联成品，平台无法创建内容" };
  }
  return {
    ok: true,
    externalId: `${platform.slice(0, 2).toUpperCase()}-${Date.now().toString(36)}`,
    message: options.successMessage || `${platform} 平台任务已提交`,
  };
}

module.exports = {
  createAdapter,
  simulatePlatformCall,
};
