const {
  contentAccountsForProduct,
  accountCanPublish,
  dailyPublishCount,
  parseDailyLimit,
} = require("./account-utils");
const {
  computeAssetMetrics,
  computeAccountMetrics,
  computeProductMetrics,
} = require("./analytics-service");
const { buildPreferredCopyParams } = require("./template-ab-service");

const PERSONA_CATEGORY_BOOST = {
  种草展示: ["家居日用", "美妆护肤", "休闲食品", "服装配饰"],
  测评讲解: ["数码配件"],
  生活方式种草: ["家居日用", "旅行用品", "服装配饰", "美妆护肤"],
  商品管理: ["家居日用", "数码配件", "休闲食品"],
};

const ANGLE_BY_PERSONA = {
  种草展示: "以真实使用场景切入，突出体验感与购买理由，口吻轻松种草，避免硬广。",
  测评讲解: "结构化测评：先说痛点再给解决方案，语气专业可信，适合理性决策用户。",
  生活方式种草: "氛围感日常 vlog 风格，强调生活场景与情绪价值，适合小红书/抖音。",
  商品管理: "促销转化导向，卖点直给、价格/优惠清晰，适合店铺账号转化。",
};

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function countMissingMaterials(product) {
  return ["imageStatus", "copyStatus", "videoStatus"].filter(
    (field) => !["已生成", "已发布", "已加入发布"].includes(product[field])
  ).length;
}

function scoreAssetPerformance(asset, publishTasks) {
  const linked = publishTasks.filter((item) => item.assetId === asset.id);
  const success = linked.filter((item) => item.status === "已成功").length;
  const usage = asset.publishCount || linked.length;
  let score = usage * 12 + success * 18;
  if (asset.isPrimary) score += 15;
  if (asset.status === "已发布") score += 10;
  if (linked.length) score += pct(success, linked.length) * 0.4;
  return Math.round(score);
}

function pickRecommendedAsset(db, productId) {
  const product = (db.products || []).find((item) => item.id === productId);
  if (!product) return null;

  const publishTasks = db.publishTasks || [];
  const assets = (db.assets || []).filter(
    (item) => item.productId === productId && ["已生成", "已发布"].includes(item.status)
  );
  if (!assets.length) return null;

  const ranked = assets
    .map((asset) => {
      const score = scoreAssetPerformance(asset, publishTasks);
      const reasons = [];
      if (asset.publishCount > 0 || publishTasks.some((item) => item.assetId === asset.id)) {
        reasons.push(`已被发布 ${asset.publishCount || publishTasks.filter((item) => item.assetId === asset.id).length} 次`);
      }
      if (asset.isPrimary) reasons.push("当前主图");
      if (asset.kind === "video") reasons.push("视频转化通常更高");
      if (!reasons.length) reasons.push("素材完整，可作为首发成品");

      return {
        assetId: asset.id,
        name: asset.name,
        kind: asset.kind,
        score,
        reason: reasons.slice(0, 2).join("；"),
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0] || null;
}

function scoreAccountForProduct(db, product, account, accountMetricsMap) {
  const metrics = accountMetricsMap.get(account.id) || { successRate: 0, publishCount: 0 };
  let score = 40;
  const reasons = [];

  if ((product.platforms || []).includes(account.platform)) {
    score += 18;
    reasons.push(`平台匹配「${account.platform}」`);
  }

  const boostCategories = PERSONA_CATEGORY_BOOST[account.persona] || [];
  if (boostCategories.includes(product.category)) {
    score += 16;
    reasons.push(`人设「${account.persona}」适合${product.category}`);
  }

  if (metrics.publishCount > 0) {
    score += Math.min(24, Math.round(metrics.successRate * 0.24));
    reasons.push(`历史成功率 ${metrics.successRate}%`);
  } else {
    reasons.push("暂无发布数据，按人设与平台匹配");
  }

  const bound = (product.accounts || []).includes(account.name);
  if (bound) {
    score += 8;
    reasons.push("已绑定该商品");
  }

  const auth = accountCanPublish(account);
  if (!auth.ok) {
    score -= 30;
    reasons.push(auth.reason);
  } else if (auth.warn) {
    reasons.push(auth.warn);
  }

  const limit = parseDailyLimit(account.rule);
  if (limit > 0) {
    const used = dailyPublishCount(db, account.id, "今天");
    if (used >= limit) {
      score -= 25;
      reasons.push(`今日额度已满（${used}/${limit}）`);
    }
  }

  const suggestedAngle = ANGLE_BY_PERSONA[account.persona] || "突出商品核心卖点，语气符合平台常见内容风格。";

  return {
    accountId: account.id,
    name: account.name,
    platform: account.platform,
    persona: account.persona,
    score: Math.max(0, Math.min(100, score)),
    reason: reasons.slice(0, 3).join("；"),
    suggestedAngle,
  };
}

function matchAccountsForProduct(db, product) {
  const accountMetrics = computeAccountMetrics(db);
  const metricsMap = new Map(accountMetrics.map((item) => [item.accountId, item]));

  const candidates = contentAccountsForProduct(db, product);
  const pool = candidates.length ? candidates : (db.accounts || []).filter((item) => item.type === "内容账号");

  return pool
    .map((account) => scoreAccountForProduct(db, product, account, metricsMap))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function recommendWorkflowTemplate(db, product) {
  const missing = countMissingMaterials(product);
  const running = (db.workflowInstances || []).find(
    (item) => item.productId === product.id && ["执行中", "等待确认"].includes(item.status)
  );
  if (running) {
    return { name: running.template, reason: `已有进行中的「${running.template}」流程`, workflowId: running.id };
  }
  if (product.stock === 0) {
    return { name: "仅生成成品", reason: "库存为 0，先补素材，恢复库存后再发布" };
  }
  if (missing === 3) {
    return { name: "全自动运营", reason: "新商品缺全部素材，建议跑全自动链路" };
  }
  if (missing > 0) {
    return { name: "新品半自动", reason: `还缺 ${missing} 项素材，半自动补齐后发布` };
  }
  if (product.publishStatus !== "已发布") {
    return { name: "快速发布", reason: "素材已齐，可走快速发布模板" };
  }
  return { name: "仅生成成品", reason: "已发布过，适合补充新成品做 A/B 测试" };
}

function buildDifferentiatedCopyPlans(db, product, accountMatches) {
  return accountMatches.slice(0, 3).map((match, index) => ({
    accountId: match.accountId,
    accountName: match.name,
    platform: match.platform,
    persona: match.persona,
    extraPrompt: `${match.suggestedAngle} 请与已有 ${index + 1} 号账号文案明显差异化，避免重复表达。`,
    copyType: index === 0 ? "发布文案" : index === 1 ? "核心卖点" : "视频脚本",
  }));
}

function buildProductStrategy(db, productId) {
  const product = (db.products || []).find((item) => item.id === productId);
  if (!product) return { error: "Product not found" };

  const recommendedAsset = pickRecommendedAsset(db, productId);
  const recommendedTemplate = recommendWorkflowTemplate(db, product);
  const accountMatches = matchAccountsForProduct(db, product);
  const copyPlans = buildDifferentiatedCopyPlans(db, product, accountMatches);

  const hints = [];
  if (recommendedAsset?.kind === "image" && !recommendedAsset.reason.includes("主图")) {
    hints.push(`建议优先使用「${recommendedAsset.name}」作为主图或发布素材。`);
  }
  if (accountMatches[0]) {
    hints.push(`首选账号「${accountMatches[0].name}」（匹配分 ${accountMatches[0].score}）。`);
  }
  if (countMissingMaterials(product) > 0) {
    hints.push(`还缺 ${countMissingMaterials(product)} 项素材，可先一键补全或启动「${recommendedTemplate.name}」。`);
  }
  if (!hints.length) hints.push("素材与账号配置良好，可直接矩阵发布或做差异化文案测试。");

  return {
    productId,
    productName: product.name,
    recommendedAsset,
    recommendedTemplate,
    accountMatches,
    copyPlans,
    hints,
    generatedAt: new Date().toISOString(),
  };
}

function buildStrategySummary(db) {
  const productMetrics = computeProductMetrics(db);
  const assetMetrics = computeAssetMetrics(db);
  const topAssets = assetMetrics.filter((item) => item.usageCount > 0).slice(0, 5);
  const opportunities = (db.products || [])
    .map((product) => {
      const strategy = buildProductStrategy(db, product.id);
      return {
        productId: product.id,
        name: product.name,
        score: productMetrics.find((item) => item.productId === product.id)?.score || 0,
        missingMaterials: countMissingMaterials(product),
        recommendedTemplate: strategy.recommendedTemplate?.name || "",
        topAccount: strategy.accountMatches[0]?.name || "",
      };
    })
    .sort((a, b) => b.score - a.score || a.missingMaterials - b.missingMaterials);

  return {
    generatedAt: new Date().toISOString(),
    topPerformingAssets: topAssets,
    productOpportunities: opportunities.slice(0, 10),
    totalProducts: (db.products || []).length,
    productsNeedingMaterials: opportunities.filter((item) => item.missingMaterials > 0).length,
  };
}

function applyStrategyAction(db, productId, body, helpers, workflowFns) {
  const product = (db.products || []).find((item) => item.id === productId);
  if (!product) return { error: "Product not found" };

  const strategy = buildProductStrategy(db, productId);
  const action = body.action;

  if (action === "set-recommended-primary") {
    const assetId = body.assetId || strategy.recommendedAsset?.assetId;
    const asset = (db.assets || []).find((item) => item.id === assetId && item.productId === productId);
    if (!asset || asset.kind !== "image") return { error: "没有可设为主图的推荐成品" };
    (db.assets || []).forEach((item) => {
      if (item.productId === productId && item.kind === "image") item.isPrimary = item.id === asset.id;
    });
    helpers.addLog(db, productId, `[策略] 已采纳推荐主图「${asset.name}」`, "strategy");
    return { ok: true, message: "已设为主图", assetId: asset.id };
  }

  if (action === "start-differentiated-copy") {
    const plans = strategy.copyPlans.slice(0, Number(body.limit) || 3);
    if (!plans.length) return { error: "没有可用的差异化文案计划，请先绑定内容账号" };
    const started = [];
    plans.forEach((plan) => {
      const preferred = buildPreferredCopyParams(db, plan.copyType);
      const task = helpers.createGenerationTask(db, product, "copy", {
        copyType: plan.copyType,
        platform: plan.platform || preferred?.platform,
        accountId: plan.accountId,
        accountName: plan.accountName,
        versionCount: 2,
        extraPrompt: [plan.extraPrompt, preferred?.extraPrompt].filter(Boolean).join(" "),
      });
      helpers.scheduleGenerationTask(task.id);
      started.push(task.id);
    });
    helpers.addLog(db, productId, `[策略] 已启动 ${started.length} 条差异化文案生成`, "strategy");
    return { ok: true, message: `Started ${started.length} copy tasks`, taskIds: started };
  }

  if (action === "start-recommended-workflow") {
    const template = body.template || strategy.recommendedTemplate?.name || "新品半自动";
    const result = workflowFns.createWorkflowInstance(db, productId, template, helpers, {
      multiAccount: template === "全自动运营" ? body.multiAccount !== false : false,
      autoExecute: template === "全自动运营" ? body.autoExecute !== false : false,
    });
    if (result.error) return { error: result.error };
    workflowFns.advanceWorkflow(db, result.instance.id, helpers);
    helpers.addLog(db, productId, `[策略] 已启动推荐流程「${template}」`, "strategy");
    return { ok: true, message: "Workflow started", workflowId: result.instance.id };
  }

  return { error: "Unknown strategy action" };
}

function isProductWorkflowEligible(db, productId) {
  const product = (db.products || []).find((item) => item.id === productId);
  if (!product || product.stock === 0 || product.status === "已暂停") return false;
  return !(db.workflowInstances || []).some(
    (item) => item.productId === productId && ["执行中", "等待确认"].includes(item.status)
  );
}

function applyBatchStrategy(db, body, helpers, workflowFns) {
  const action = body.action || "start-recommended-workflows";
  const limit = Math.min(20, Math.max(1, Number(body.limit) || 10));
  const filterIds = Array.isArray(body.productIds) ? new Set(body.productIds) : null;

  if (action === "start-recommended-workflows") {
    const opportunities = buildStrategySummary(db).productOpportunities.filter((item) => {
      if (filterIds && !filterIds.has(item.productId)) return false;
      if (!isProductWorkflowEligible(db, item.productId)) return false;
      return item.missingMaterials > 0 || item.score < 80;
    });

    const started = [];
    const skipped = [];
    opportunities.slice(0, limit).forEach((item) => {
      const template = item.recommendedTemplate || "新品半自动";
      const result = workflowFns.createWorkflowInstance(db, item.productId, template, helpers, {
        multiAccount: template === "全自动运营" ? body.multiAccount !== false : false,
        autoExecute: template === "全自动运营" ? body.autoExecute !== false : false,
      });
      if (result.error) {
        skipped.push({ productId: item.productId, name: item.name, reason: result.error });
        return;
      }
      workflowFns.advanceWorkflow(db, result.instance.id, helpers);
      helpers.addLog(db, item.productId, `[策略] 批量启动推荐流程「${template}」`, "strategy");
      started.push({ productId: item.productId, name: item.name, workflowId: result.instance.id, template });
    });

    if (!started.length && !skipped.length) {
      return { error: "没有符合批量策略条件的商品（需有缺素材或低表现分，且未在流程中）" };
    }

    return {
      ok: true,
      message: `Batch started ${started.length} workflows`,
      started,
      skipped,
      count: started.length,
      partialSuccess: started.length > 0 && skipped.length > 0,
    };
  }

  return { error: "Unknown batch strategy action" };
}

module.exports = {
  buildProductStrategy,
  buildStrategySummary,
  applyStrategyAction,
  applyBatchStrategy,
  pickRecommendedAsset,
  matchAccountsForProduct,
  recommendWorkflowTemplate,
};
