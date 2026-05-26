function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function generationStats(tasks, kind) {
  const list = tasks.filter((item) => item.kind === kind);
  const finished = list.filter((item) => ["已成功", "失败"].includes(item.status));
  const success = list.filter((item) => item.status === "已成功").length;
  return {
    kind,
    total: list.length,
    success,
    failed: list.filter((item) => item.status === "失败").length,
    running: list.filter((item) => ["待执行", "执行中"].includes(item.status)).length,
    successRate: pct(success, finished.length || list.length),
  };
}

function computeAutomationMetrics(db) {
  const generationTasks = db.generationTasks || [];
  const publishTasks = db.publishTasks || [];
  const listingTasks = db.listingTasks || [];
  const workflows = db.workflowInstances || [];

  const genByKind = ["image", "copy", "video"].map((kind) => generationStats(generationTasks, kind));
  const publishFinished = publishTasks.filter((item) => ["已成功", "失败"].includes(item.status));
  const publishSuccess = publishTasks.filter((item) => item.status === "已成功").length;
  const listingFinished = listingTasks.filter((item) => ["已上架", "失败"].includes(item.status));
  const listingSuccess = listingTasks.filter((item) => item.status === "已上架").length;
  const workflowFinished = workflows.filter((item) => ["已成功", "已取消"].includes(item.status));
  const workflowSuccess = workflows.filter((item) => item.status === "已成功").length;

  const readyAssets = (db.assets || []).filter((item) => item.status === "已生成").length;
  const usedAssets = (db.assets || []).filter((item) => (item.publishCount || 0) > 0 || item.status === "已发布").length;

  return {
    generation: genByKind,
    publishSuccessRate: pct(publishSuccess, publishFinished.length || publishTasks.length),
    listingSuccessRate: pct(listingSuccess, listingFinished.length || listingTasks.length),
    workflowSuccessRate: pct(workflowSuccess, workflowFinished.length || workflows.length),
    assetPublishConversion: pct(usedAssets, readyAssets || (db.assets || []).length),
    totals: {
      generationTasks: generationTasks.length,
      publishTasks: publishTasks.length,
      listingTasks: listingTasks.length,
      workflows: workflows.length,
      platformFailures: (db.platformFailures || []).filter((item) => item.status === "待处理").length,
    },
  };
}

function computeProductMetrics(db) {
  return (db.products || []).map((product) => {
    const productAssets = (db.assets || []).filter((item) => item.productId === product.id);
    const publishes = (db.publishTasks || []).filter((item) => item.productId === product.id);
    const publishSuccess = publishes.filter((item) => item.status === "已成功").length;
    const generations = (db.generationTasks || []).filter((item) => item.productId === product.id);
    const genSuccess = generations.filter((item) => item.status === "已成功").length;

    const materialsScore =
      [product.imageStatus, product.copyStatus, product.videoStatus].filter((s) =>
        ["已生成", "已发布", "已加入发布"].includes(s)
      ).length * 25;
    const publishScore = pct(publishSuccess, publishes.length || 1) * 0.25;
    const score = Math.min(100, Math.round(materialsScore + publishScore));

    return {
      productId: product.id,
      name: product.name,
      code: product.code,
      score,
      assetCount: productAssets.length,
      publishCount: publishes.length,
      publishSuccess,
      generationCount: generations.length,
      generationSuccess: genSuccess,
      status: product.status,
      publishStatus: product.publishStatus,
    };
  }).sort((a, b) => b.score - a.score);
}

function computeAssetMetrics(db) {
  const publishTasks = db.publishTasks || [];
  return (db.assets || [])
    .map((asset) => {
      const linked = publishTasks.filter((item) => item.assetId === asset.id);
      const success = linked.filter((item) => item.status === "已成功").length;
      const publishCount = asset.publishCount || linked.length;
      return {
        assetId: asset.id,
        name: asset.name,
        productId: asset.productId,
        productName: (db.products || []).find((p) => p.id === asset.productId)?.name || asset.productId,
        kind: asset.kind,
        type: asset.type,
        status: asset.status,
        usageCount: publishCount,
        publishSuccess: success,
        successRate: pct(success, linked.length || publishCount),
        lastUsedAt: asset.lastUsedAt || "",
        isPrimary: Boolean(asset.isPrimary),
      };
    })
    .sort((a, b) => b.usageCount - a.usageCount || b.publishSuccess - a.publishSuccess);
}

function computeAccountMetrics(db) {
  const publishTasks = db.publishTasks || [];
  return (db.accounts || [])
    .map((account) => {
      const tasks = publishTasks.filter(
        (item) => item.accountId === account.id || item.account === account.name
      );
      const success = tasks.filter((item) => item.status === "已成功").length;
      const failed = tasks.filter((item) => item.status === "失败").length;
      return {
        accountId: account.id,
        name: account.name,
        platform: account.platform,
        type: account.type,
        persona: account.persona,
        publishCount: tasks.length,
        publishSuccess: success,
        publishFailed: failed,
        successRate: pct(success, tasks.filter((t) => ["已成功", "失败"].includes(t.status)).length || tasks.length),
      };
    })
    .sort((a, b) => b.publishSuccess - a.publishSuccess || b.publishCount - a.publishCount);
}

function buildOptimizationHints(db, metrics) {
  const hints = [];
  const lowGen = metrics.automation.generation.find((item) => item.total >= 3 && item.successRate < 70);
  if (lowGen) {
    hints.push(`${lowGen.kind === "copy" ? "文案" : lowGen.kind === "video" ? "视频" : "图片"}生成成功率偏低（${lowGen.successRate}%），建议检查 API 配置或调整生成参数。`);
  }
  if (metrics.automation.publishSuccessRate < 80 && metrics.automation.totals.publishTasks >= 2) {
    hints.push(`发布成功率 ${metrics.automation.publishSuccessRate}%，优先处理发布中心异常队列。`);
  }
  const topAccount = metrics.accounts[0];
  const weakAccount = metrics.accounts.find((item) => item.publishCount >= 2 && item.successRate < 60);
  if (topAccount?.publishSuccess > 0) {
    hints.push(`表现最好账号：「${topAccount.name}」（成功率 ${topAccount.successRate}%），可优先排期。`);
  }
  if (weakAccount) {
    hints.push(`账号「${weakAccount.name}」发布成功率仅 ${weakAccount.successRate}%，建议检查授权或换账号。`);
  }
  const topAsset = metrics.assets.find((item) => item.usageCount > 0);
  if (topAsset) {
    hints.push(`最常用成品：「${topAsset.name}」（使用 ${topAsset.usageCount} 次），同类商品可参考其风格。`);
  }
  if (!hints.length) hints.push("数据样本较少，多跑几条生成/发布任务后可获得更准的优化建议。");
  return hints.slice(0, 4);
}

function buildAnalyticsSummary(db) {
  const automation = computeAutomationMetrics(db);
  const products = computeProductMetrics(db);
  const assets = computeAssetMetrics(db);
  const accounts = computeAccountMetrics(db);
  const hints = buildOptimizationHints(db, { automation, accounts, assets });

  return {
    generatedAt: new Date().toISOString(),
    automation,
    products,
    assets: assets.slice(0, 20),
    accounts,
    hints,
  };
}

module.exports = {
  buildAnalyticsSummary,
  computeAutomationMetrics,
  computeProductMetrics,
  computeAssetMetrics,
  computeAccountMetrics,
};
