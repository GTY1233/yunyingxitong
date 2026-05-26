const { contentAccountsForProduct, resolvePublishAccount } = require("./account-utils");

const CATEGORY_HINTS = [
  ["家居", "家居日用"],
  ["杯", "家居日用"],
  ["灯", "数码配件"],
  ["包", "旅行用品"],
  ["食品", "休闲食品"],
  ["燕麦", "休闲食品"],
  ["服装", "服装配饰"],
  ["美妆", "美妆护肤"],
];

function autoRecognizeFields(body = {}) {
  const name = String(body.name || "").trim();
  const next = { ...body };
  if (!next.category || next.category === "待识别") {
    const hit = CATEGORY_HINTS.find(([keyword]) => name.includes(keyword));
    if (hit) next.category = hit[1];
  }
  if (!next.sellingPoints || String(next.sellingPoints).includes("待补充")) {
    next.sellingPoints = name ? `${name}，待运营补充详细卖点。` : next.sellingPoints;
  }
  if (!next.platforms?.length || next.platforms[0] === "待选择") {
    next.platforms = body.platforms?.length ? body.platforms : ["抖音", "小红书"];
  }
  return next;
}

function pickPublishAsset(db, product) {
  const assets = (db.assets || []).filter(
    (item) => item.productId === product.id && ["已生成", "已发布"].includes(item.status)
  );
  return (
    assets.find((item) => item.kind === "video") ||
    assets.find((item) => item.kind === "image" && item.isPrimary) ||
    assets.find((item) => item.kind === "image") ||
    assets.find((item) => item.kind === "copy") ||
    null
  );
}

function getEligibleAutoOpsProducts(db) {
  return (db.products || []).filter((product) => {
    if (product.stock === 0 || product.status === "已暂停") return false;
    const running = (db.workflowInstances || []).some(
      (item) => item.productId === product.id && ["执行中", "等待确认"].includes(item.status)
    );
    return !running;
  });
}

function startAutoOpsBatch(db, productIds, options, helpers, workflowFns) {
  const template = options.template || "全自动运营";
  const workflowOptions = {
    multiAccount: options.multiAccount !== false,
    autoExecute: options.autoExecute !== false,
  };
  const started = [];
  const skipped = [];

  (productIds || []).forEach((productId) => {
    const result = workflowFns.createWorkflowInstance(db, productId, template, helpers, workflowOptions);
    if (result.error) {
      skipped.push({ productId, reason: result.error });
      return;
    }
    workflowFns.advanceWorkflow(db, result.instance.id, helpers);
    started.push({ productId, workflowId: result.instance.id });
    helpers.addLog(db, productId, `[全自动] 已启动流程（${result.instance.id}）`, "workflow");
  });

  return {
    started,
    skipped,
    count: started.length,
    partialSuccess: started.length > 0 && skipped.length > 0,
  };
}

module.exports = {
  autoRecognizeFields,
  pickPublishAsset,
  getEligibleAutoOpsProducts,
  startAutoOpsBatch,
  getContentAccounts: contentAccountsForProduct,
  getDefaultAccount: resolvePublishAccount,
};
