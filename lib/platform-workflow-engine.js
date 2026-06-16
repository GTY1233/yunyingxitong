const { defaultGenerationParams } = require("./workflow-params");
const { pickTemplateForNode, mergeGenerationParams } = require("./generation-template-service");
const { ensurePlatformDemoAccounts, isPlatformDemoMode } = require("./platform-demo");
const { buildStoreListingPayload } = require("./store-listing-service");
const { checkObserveNode } = require("./platform-observe-service");
const { resolveWorkflowAccounts } = require("./account-utils");

const PLATFORM_CHAINS = {
  抖音: [
    { key: "product_info", label: "商品资料", type: "manual" },
    { key: "generate_image", label: "图片生成", type: "generate", kind: "image" },
    { key: "generate_copy", label: "商品文案", type: "generate", kind: "copy", params: { copyType: "详情文案" } },
    { key: "generate_video", label: "视频生成", type: "generate", kind: "video" },
    { key: "generate_video_copy", label: "视频文案", type: "generate", kind: "copy", params: { copyType: "发布文案" } },
    { key: "wait_confirm", label: "预览确认", type: "manual" },
    { key: "listing_confirm", label: "主店上架确认", type: "manual" },
    { key: "create_listing", label: "主店上架", type: "listing" },
    { key: "observe_authorized", label: "授权号橱窗同步", type: "observe", hint: "主店上架后，抖店后台开启授权号自动同步；此处确认橱窗已出现商品。" },
    { key: "observe_alliance", label: "精选联盟推广", type: "observe", hint: "确认新品已加入精选联盟自动推广。" },
    { key: "create_publish", label: "矩阵内容发布", type: "publish", multiAccount: true },
    { key: "data_done", label: "数据回流", type: "observe", hint: "发布完成后记录数据，后续版本接数据中心。" },
  ],
  小红书: [
    { key: "product_info", label: "商品资料", type: "manual" },
    { key: "generate_image", label: "图片生成", type: "generate", kind: "image", params: { imageType: "商品主图" } },
    { key: "generate_copy", label: "商品文案", type: "generate", kind: "copy", params: { copyType: "发布文案" } },
    { key: "generate_video", label: "视频生成", type: "generate", kind: "video" },
    { key: "generate_video_copy", label: "发布文案", type: "generate", kind: "copy", params: { copyType: "发布文案" } },
    { key: "wait_confirm", label: "预览确认", type: "manual" },
    { key: "create_listing", label: "店铺上架", type: "listing" },
    { key: "create_publish", label: "单账号发布", type: "publish", multiAccount: false },
    { key: "data_done", label: "数据回流", type: "observe", hint: "记录发布结果。" },
  ],
  淘宝: [
    { key: "product_info", label: "商品资料", type: "manual" },
    { key: "generate_image", label: "主图与详情图", type: "generate", kind: "image", params: { imageType: "详情页图", imageCount: 4 } },
    { key: "generate_copy", label: "标题与详情文案", type: "generate", kind: "copy", params: { copyType: "商品标题" } },
    { key: "wait_confirm", label: "预览确认", type: "manual" },
    { key: "create_listing", label: "店铺上架", type: "listing" },
    { key: "data_done", label: "数据回流", type: "observe", hint: "上架完成，记录结果。" },
  ],
};

const OBSERVE_HINTS = {
  authorized_window: "主店商品上架后，授权号橱窗约 10 分钟内自动同步，无需重复上架。",
  alliance: "开启精选联盟「新品自动推广」后，达人可在联盟搜索到商品。",
  data: "数据回流节点占位，M14 后续接统计 API。",
};

function listPlatformChainTemplates() {
  return Object.entries(PLATFORM_CHAINS).map(([platform, nodes]) => ({
    platform,
    template: `${platform}链路`,
    stepCount: nodes.length,
    steps: nodes.map((item) => item.label),
  }));
}

function kindToStatusField(kind) {
  if (kind === "copy") return "copyStatus";
  if (kind === "video") return "videoStatus";
  return "imageStatus";
}

function materialReady(product, kind) {
  return ["已生成", "已发布", "已加入发布"].includes(product[kindToStatusField(kind)]);
}

function materialGenerating(product, kind) {
  return product[kindToStatusField(kind)] === "生成中";
}

function getActiveNode(instance) {
  return instance.nodes.find((node) => !["已成功", "已跳过"].includes(node.status)) || null;
}

function computeProgress(instance) {
  const done = instance.nodes.filter((node) => ["已成功", "已跳过"].includes(node.status)).length;
  return Math.round((done / instance.nodes.length) * 100);
}

function generationParamsForNode(node, product, platform, instanceId = "") {
  const base = defaultGenerationParams(node.kind, product);
  const template = pickTemplateForNode(node, platform);
  return mergeGenerationParams(template, {
    ...base,
    platform,
    platformWorkflowId: instanceId,
    ...(node.params || {}),
  });
}

function productInfoReady(product) {
  return Boolean(String(product.name || "").trim() && String(product.sellingPoints || "").trim());
}

function markNodeSuccess(node) {
  node.status = "已成功";
  node.error = "";
}

function markNodeFailed(node, message) {
  node.status = "失败";
  node.error = message || "节点执行失败";
}

function createPlatformWorkflows(db, productId, platforms, helpers) {
  const product = (db.products || []).find((item) => item.id === productId);
  if (!product) return { error: "Product not found" };

  const selected = (platforms || []).filter((p) => PLATFORM_CHAINS[p]);
  if (!selected.length) return { error: "请至少选择一个平台：抖音、小红书、淘宝" };

  db.platformWorkflows = db.platformWorkflows || [];
  const created = [];
  const skipped = [];

  selected.forEach((platform) => {
    const existing = db.platformWorkflows.find(
      (item) =>
        item.productId === productId &&
        item.platform === platform &&
        ["执行中", "等待确认", "失败"].includes(item.status)
    );
    if (existing) {
      skipped.push({ platform, reason: "已有进行中的工作流" });
      return;
    }

    const chain = PLATFORM_CHAINS[platform];
    const instance = {
      id: helpers.nextId(db.platformWorkflows, "PW"),
      productId,
      productName: product.name,
      platform,
      template: `${platform}链路`,
      status: "执行中",
      progress: 0,
      nodes: chain.map((item, index) => ({
        id: `n${index + 1}`,
        key: item.key,
        label: item.label,
        type: item.type,
        kind: item.kind || "",
        hint: item.hint || OBSERVE_HINTS[item.observeType] || "",
        multiAccount: item.multiAccount,
        status: "待执行",
        taskId: "",
        taskIds: [],
        error: "",
      })),
      createdAt: helpers.formatNow(),
      updatedAt: helpers.formatNow(),
    };

    ensurePlatformDemoAccounts(db, product, platform, helpers);
    db.platformWorkflows.unshift(instance);
    helpers.addLog(db, productId, `[${platform}工作流] 已创建（${instance.id}）`, "workflow");
    advancePlatformWorkflow(db, instance.id, helpers);
    created.push(instance);
  });

  const targets = [...new Set([...(product.platforms || []), ...selected])];
  product.platforms = targets;

  return { created, skipped, count: created.length };
}

function advancePlatformWorkflow(db, instanceId, helpers) {
  const instance = (db.platformWorkflows || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Platform workflow not found" };
  if (["已成功", "已取消"].includes(instance.status)) return { instance, done: true };

  const node = getActiveNode(instance);
  if (!node) {
    instance.status = "已成功";
    instance.progress = 100;
    instance.updatedAt = helpers.formatNow();
    return { instance, done: true };
  }

  instance.currentNodeId = node.id;
  const product = (db.products || []).find((item) => item.id === instance.productId);
  if (!product) return { error: "Product not found" };

  if (node.type === "manual") {
    node.status = "等待确认";
    instance.status = "等待确认";
    instance.progress = computeProgress(instance);
    instance.updatedAt = helpers.formatNow();
    helpers.addLog(db, product.id, `[流程] 商品资料已提交，等待确认（${instance.id}）`, "workflow");
    return { instance, waitingConfirm: true };
  }

  if (node.type === "generate") {
    if (materialReady(product, node.kind)) {
      markNodeSuccess(node);
      instance.progress = computeProgress(instance);
      instance.updatedAt = helpers.formatNow();
      return advancePlatformWorkflow(db, instanceId, helpers);
    }
    if (materialGenerating(product, node.kind)) {
      const hasActiveTask = (db.generationTasks || []).some(
        (t) => t.productId === product.id && t.kind === node.kind && ["待执行", "执行中"].includes(t.status)
      );
      if (hasActiveTask) {
        node.status = "执行中";
        instance.status = "执行中";
        instance.progress = computeProgress(instance);
        instance.updatedAt = helpers.formatNow();
        return { instance, waiting: true };
      }
      product[kindToStatusField(node.kind)] = "";
    }
    return { instance };
  }

  if (node.type === "listing") {
    try {
      if (product.stock === 0) throw new Error("库存为 0，无法创建上架草稿");
      const shop = resolveWorkflowAccounts(db, product, instance.platform, { role: "shop" })[0];
      node.storeListingPayload = buildStoreListingPayload(db, product, instance.platform);
      const task = helpers.createListingTask(
        db,
        product,
        {
          workflowId: instance.id,
          platform: instance.platform,
          account: shop?.name || `${instance.platform}店铺`,
          mode: isPlatformDemoMode() ? "自动上架" : "半自动",
        },
        helpers
      );
      node.taskId = task.id;
      const exec = helpers.executeListingTask(db, task.id, helpers);
      if (exec.error && !exec.task) throw new Error(exec.error);
      if (exec.task?.status === "失败") throw new Error(exec.task.failureReason || "上架失败");
      node.externalId = exec.task?.externalId || "";
      markNodeSuccess(node);
      instance.progress = computeProgress(instance);
      instance.updatedAt = helpers.formatNow();
      helpers.addLog(
        db,
        product.id,
        `[${instance.platform}] 主店上架完成（${exec.task?.externalId || task.id}）`,
        "listing"
      );
      return advancePlatformWorkflow(db, instanceId, helpers);
    } catch (error) {
      markNodeFailed(node, error.message);
      instance.status = "失败";
      instance.updatedAt = helpers.formatNow();
      return { instance, failed: true, error: error.message };
    }
  }

  if (node.type === "publish") {
    try {
      if (product.stock === 0) throw new Error("库存为 0，无法创建发布任务");
      const asset = helpers.pickPublishAsset ? helpers.pickPublishAsset(db, product) : null;
      const useMulti = node.multiAccount !== false && instance.platform === "抖音";
      const accounts = resolveWorkflowAccounts(db, product, instance.platform, {
        matrix: useMulti,
        single: !useMulti,
      });
      if (!accounts.length) throw new Error(`无可用${instance.platform}内容账号`);

      node.taskIds = [];
      const publishResults = [];
      accounts.forEach((account) => {
        const task = helpers.createPublishTask(
          db,
          product,
          {
            accountId: account.id,
            account: account.name,
            assetId: asset?.id || "",
            mode: isPlatformDemoMode() ? "半自动" : "半自动",
            workflowId: instance.id,
            platform: instance.platform,
            force: isPlatformDemoMode(),
          },
          asset
        );
        node.taskIds.push(task.id);
        if (helpers.executePublishTask) {
          const exec = helpers.executePublishTask(db, task.id, helpers);
          publishResults.push(exec);
        }
      });
      const failed = publishResults.filter((item) => item.task?.status === "失败" || item.error);
      if (failed.length === publishResults.length && publishResults.length) {
        throw new Error(failed[0].error || failed[0].task?.failureReason || "矩阵发布全部失败");
      }
      markNodeSuccess(node);
      instance.progress = computeProgress(instance);
      instance.updatedAt = helpers.formatNow();
      helpers.addLog(
        db,
        product.id,
        `[${instance.platform}] 矩阵发布已提交 ${node.taskIds.length} 条（${failed.length} 失败）`,
        "publish"
      );
      return advancePlatformWorkflow(db, instanceId, helpers);
    } catch (error) {
      markNodeFailed(node, error.message);
      instance.status = "失败";
      instance.updatedAt = helpers.formatNow();
      return { instance, failed: true, error: error.message };
    }
  }

  if (node.type === "observe") {
    const check = checkObserveNode(db, instance, node);
    node.observeStatus = check.status;
    node.observeDetail = check.message;
    node.platformProductId = check.platformProductId || "";
    if (check.ok && check.autoConfirm) {
      markNodeSuccess(node);
      instance.status = "执行中";
      instance.progress = computeProgress(instance);
      instance.updatedAt = helpers.formatNow();
      helpers.addLog(db, instance.productId, `[${instance.platform}] ${node.label}：${check.message}`, "workflow");
      return advancePlatformWorkflow(db, instanceId, helpers);
    }
    node.status = check.ok ? "等待确认" : "等待确认";
    instance.status = "等待确认";
    instance.progress = computeProgress(instance);
    instance.updatedAt = helpers.formatNow();
    return { instance, waitingConfirm: true, observe: true, observeCheck: check };
  }

  return { instance };
}

function confirmPlatformWorkflow(db, instanceId, helpers) {
  const instance = (db.platformWorkflows || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Platform workflow not found" };
  const node = getActiveNode(instance);
  if (!node || node.status !== "等待确认") return { error: "当前节点不需要确认" };

  if (node.key === "wait_confirm") {
    markNodeSuccess(node);
    instance.status = "执行中";
    instance.progress = computeProgress(instance);
    instance.updatedAt = helpers.formatNow();
    helpers.addLog(db, instance.productId, `[${instance.platform}] 已确认「${node.label}」`, "workflow");
    return advancePlatformWorkflow(db, instanceId, helpers);
  }

  markNodeSuccess(node);
  instance.status = "执行中";
  instance.progress = computeProgress(instance);
  instance.updatedAt = helpers.formatNow();
  helpers.addLog(db, instance.productId, `[${instance.platform}] 已确认「${node.label}」`, "workflow");
  return advancePlatformWorkflow(db, instanceId, helpers);
}

function skipPlatformWorkflow(db, instanceId, helpers) {
  const instance = (db.platformWorkflows || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Platform workflow not found" };
  const node = getActiveNode(instance);
  if (!node) return { error: "No active node" };
  node.status = "已跳过";
  node.error = "";
  instance.status = "执行中";
  instance.progress = computeProgress(instance);
  instance.updatedAt = helpers.formatNow();
  helpers.addLog(db, instance.productId, `[${instance.platform}] 已跳过「${node.label}」`, "workflow");
  return advancePlatformWorkflow(db, instanceId, helpers);
}

function retryPlatformWorkflow(db, instanceId, helpers) {
  const instance = (db.platformWorkflows || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Platform workflow not found" };
  const node = getActiveNode(instance);
  if (!node || node.status !== "失败") return { error: "没有可重试的失败节点" };
  node.status = "待执行";
  node.error = "";
  node.taskId = "";
  instance.status = "执行中";
  instance.updatedAt = helpers.formatNow();
  return advancePlatformWorkflow(db, instanceId, helpers);
}

function onPlatformGenerationComplete(db, productId, kind, helpers) {
  (db.platformWorkflows || [])
    .filter((item) => item.productId === productId && ["执行中", "等待确认"].includes(item.status))
    .forEach((instance) => {
      const node = getActiveNode(instance);
      if (!node || node.type !== "generate" || node.kind !== kind || node.status !== "执行中") return;
      markNodeSuccess(node);
      instance.progress = computeProgress(instance);
      instance.updatedAt = helpers.formatNow();
      advancePlatformWorkflow(db, instance.id, helpers);
    });
}

function onPlatformGenerationFailed(db, productId, kind, message, helpers) {
  (db.platformWorkflows || []).forEach((instance) => {
    if (instance.productId !== productId || instance.status !== "执行中") return;
    const node = getActiveNode(instance);
    if (!node || node.type !== "generate" || node.kind !== kind) return;
    markNodeFailed(node, message);
    instance.status = "失败";
    instance.updatedAt = helpers.formatNow();
    helpers.addLog(db, productId, `[${instance.platform}] 生成失败：${node.label}`, "workflow");
  });
}

function getProductPlatformWorkflows(db, productId) {
  return (db.platformWorkflows || []).filter((item) => item.productId === productId);
}

function getInboxPlatformWorkflowItems(db) {
  return (db.platformWorkflows || [])
    .filter((item) => ["等待确认", "失败"].includes(item.status))
    .map((item) => {
      const node = getActiveNode(item);
      return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        platform: item.platform,
        status: item.status,
        nodeLabel: node?.label || "",
        error: node?.error || "",
      };
    });
}

function observePlatformWorkflowCheck(db, instanceId, helpers = {}) {
  const instance = (db.platformWorkflows || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Platform workflow not found" };
  const node = getActiveNode(instance);
  if (!node || node.type !== "observe") return { error: "当前节点不是观测步骤" };
  const check = checkObserveNode(db, instance, node);
  node.observeStatus = check.status;
  node.observeDetail = check.message;
  node.platformProductId = check.platformProductId || "";
  instance.updatedAt = helpers.formatNow ? helpers.formatNow() : new Date().toISOString();
  return { instance, check };
}

function executePlatformWorkflowPublish(db, instanceId, helpers) {
  const instance = (db.platformWorkflows || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Platform workflow not found" };
  const node = getActiveNode(instance);
  if (!node || node.type !== "publish") return { error: "当前节点不是发布步骤" };
  if (!node.taskIds?.length) return advancePlatformWorkflow(db, instanceId, helpers);
  const results = (node.taskIds || []).map((taskId) => helpers.executePublishTask(db, taskId, helpers));
  const failed = results.filter((item) => item.error || item.task?.status === "失败");
  if (failed.length && failed.length === results.length) {
    return { error: failed[0].error || failed[0].task?.failureReason || "发布失败", instance };
  }
  markNodeSuccess(node);
  instance.status = "执行中";
  instance.progress = computeProgress(instance);
  instance.updatedAt = helpers.formatNow();
  return advancePlatformWorkflow(db, instanceId, helpers);
}

module.exports = {
  PLATFORM_CHAINS,
  listPlatformChainTemplates,
  createPlatformWorkflows,
  advancePlatformWorkflow,
  confirmPlatformWorkflow,
  skipPlatformWorkflow,
  retryPlatformWorkflow,
  observePlatformWorkflowCheck,
  executePlatformWorkflowPublish,
  onPlatformGenerationComplete,
  onPlatformGenerationFailed,
  getProductPlatformWorkflows,
  getInboxPlatformWorkflowItems,
  getActiveNode,
  computeProgress,
};
