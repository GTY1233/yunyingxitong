function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function buildTemplateAbReport(db) {
  const groups = new Map();

  (db.assets || [])
    .filter((item) => item.kind === "copy")
    .forEach((asset) => {
      const task = (db.generationTasks || []).find(
        (item) => item.assetId === asset.id && item.status === "已成功"
      );
      const copyType = task?.params?.copyType || asset.type || "发布文案";
      const persona = task?.params?.accountPersona || "默认人设";
      const platform = task?.params?.platform || "全平台";
      const key = `${copyType}|${persona}|${platform}`;

      const publishes = (db.publishTasks || []).filter((item) => item.assetId === asset.id);
      const success = publishes.filter((item) => item.status === "已成功").length;

      if (!groups.has(key)) {
        groups.set(key, {
          copyType,
          persona,
          platform,
          assetCount: 0,
          publishCount: 0,
          successCount: 0,
          usageTotal: 0,
        });
      }

      const group = groups.get(key);
      group.assetCount += 1;
      group.publishCount += publishes.length;
      group.successCount += success;
      group.usageTotal += asset.publishCount || publishes.length;
    });

  const variants = [...groups.values()]
    .map((item) => ({
      ...item,
      successRate: pct(item.successCount, item.publishCount),
      score: item.usageTotal * 8 + item.successCount * 15 + pct(item.successCount, item.publishCount),
    }))
    .sort((a, b) => b.score - a.score || b.successRate - a.successRate);

  const winnersByCopyType = new Map();
  variants.forEach((item) => {
    if (!winnersByCopyType.has(item.copyType) && item.publishCount > 0) {
      winnersByCopyType.set(item.copyType, item);
    }
  });

  const recommendations = [...winnersByCopyType.values()].map((item) => ({
    copyType: item.copyType,
    persona: item.persona,
    platform: item.platform,
    successRate: item.successRate,
    hint: `「${item.copyType}」+ ${item.persona}（${item.platform}）成功率 ${item.successRate}%`,
  }));

  const hints = [];
  if (!variants.length) {
    hints.push("暂无文案 A/B 数据，发布成功后会自动统计各文案类型与人设表现。");
  } else {
    recommendations.slice(0, 3).forEach((item) => hints.push(`优先使用 ${item.hint}`));
    const lowPerformers = variants.filter((item) => item.publishCount >= 2 && item.successRate < 40);
    if (lowPerformers.length) {
      hints.push(`${lowPerformers.length} 组文案模板表现偏低，建议重新生成差异化版本做 A/B 测试。`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    variants: variants.slice(0, 12),
    recommendations,
    hints,
    totalVariants: variants.length,
  };
}

function buildPreferredCopyParams(db, copyType) {
  const report = buildTemplateAbReport(db);
  const winner = report.recommendations.find((item) => item.copyType === copyType) || report.recommendations[0];
  if (!winner) return null;
  return {
    copyType: winner.copyType,
    platform: winner.platform === "全平台" ? undefined : winner.platform,
    extraPrompt: `参考高表现模板：${winner.persona} 风格，强调与历史低转化文案差异化。`,
  };
}

module.exports = {
  buildTemplateAbReport,
  buildPreferredCopyParams,
};
