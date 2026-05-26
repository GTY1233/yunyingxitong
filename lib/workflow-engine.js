const { defaultGenerationParams } = require("./workflow-params");
const { resolveWorkflowTemplate, inferWorkflowOptions } = require("./workflow-orchestrator");

const WORKFLOW_TEMPLATES = {
  新品半自动: [
    { key: "generate_copy", label: "生成文案", type: "generate", kind: "copy" },
    { key: "generate_image", label: "生成图片", type: "generate", kind: "image" },
    { key: "generate_video", label: "生成视频", type: "generate", kind: "video" },
    { key: "wait_confirm", label: "等待预览确认", type: "manual" },
    { key: "create_publish", label: "创建发布任务", type: "publish" },
  ],
  快速发布: [
    { key: "generate_copy", label: "生成文案", type: "generate", kind: "copy" },
    { key: "generate_image", label: "生成图片", type: "generate", kind: "image" },
    { key: "wait_confirm", label: "等待预览确认", type: "manual" },
    { key: "create_publish", label: "创建发布任务", type: "publish" },
  ],
  仅生成成品: [
    { key: "generate_copy", label: "生成文案", type: "generate", kind: "copy" },
    { key: "generate_image", label: "生成图片", type: "generate", kind: "image" },
    { key: "generate_video", label: "生成视频", type: "generate", kind: "video" },
    { key: "wait_confirm", label: "等待预览确认", type: "manual" },
  ],
  全自动运营: [
    { key: "generate_copy", label: "生成文案", type: "generate", kind: "copy" },
    { key: "generate_image", label: "生成图片", type: "generate", kind: "image" },
    { key: "generate_video", label: "生成视频", type: "generate", kind: "video" },
    { key: "wait_confirm", label: "等待预览确认", type: "manual" },
    { key: "create_listing", label: "创建上架草稿", type: "listing" },
    { key: "create_publish", label: "矩阵创建发布", type: "publish" },
    { key: "auto_listing", label: "自动上架", type: "auto_listing" },
    { key: "auto_publish", label: "自动发布", type: "auto_publish" },
  ],
};

function listWorkflowTemplates() {
  return Object.keys(WORKFLOW_TEMPLATES).map((name) => ({
    name,
    steps: WORKFLOW_TEMPLATES[name].map((item) => item.label),
    stepCount: WORKFLOW_TEMPLATES[name].length,
  }));
}

function kindToStatusField(kind) {
  if (kind === "copy") return "copyStatus";
  if (kind === "video") return "videoStatus";
  return "imageStatus";
}

function materialReady(product, kind) {
  const status = product[kindToStatusField(kind)];
  return ["已生成", "已发布", "已加入发布"].includes(status);
}

function materialGenerating(product, kind) {
  return product[kindToStatusField(kind)] === "生成中";
}

function getActiveNode(instance) {
  return instance.nodes.find((node) => !["已成功", "已跳过"].includes(node.status)) || null;
}

function computeWorkflowProgress(instance) {
  const done = instance.nodes.filter((node) => node.status === "已成功" || node.status === "已跳过").length;
  return Math.round((done / instance.nodes.length) * 100);
}

function syncWorkflowSummaries(db) {
  db.workflows = (db.workflowInstances || []).map((instance) => {
    const product = (db.products || []).find((item) => item.id === instance.productId);
    const active = getActiveNode(instance);
    return {
      productId: instance.productId,
      product: product?.name || instance.productId,
      node: active?.label || "流程已完成",
      status: instance.status,
      progress: computeWorkflowProgress(instance),
      workflowId: instance.id,
    };
  });
}

function createWorkflowInstance(db, productId, templateName, helpers, options = {}) {
  const product = (db.products || []).find((item) => item.id === productId);
  if (!product) return { error: "Product not found" };

  const template = resolveWorkflowTemplate(db, templateName);
  if (!template) return { error: "Unknown workflow template" };

  const running = (db.workflowInstances || []).find(
    (item) => item.productId === productId && ["执行中", "等待确认"].includes(item.status)
  );
  if (running) return { error: "该商品已有进行中的流程" };

  const instance = {
    id: helpers.nextId(db.workflowInstances, "WF"),
    productId,
    productName: product.name,
    template: templateName,
    status: "执行中",
    options: inferWorkflowOptions(template, options),
    nodes: template.map((item, index) => ({
      id: `n${index + 1}`,
      key: item.key,
      label: item.label,
      type: item.type,
      kind: item.kind || "",
      status: "待执行",
      taskId: "",
      taskIds: [],
      error: "",
    })),
    createdAt: helpers.formatNow(),
    updatedAt: helpers.formatNow(),
  };

  db.workflowInstances.unshift(instance);
  helpers.addLog(db, productId, `[流程] 已启动「${templateName}」（${instance.id}）`, "workflow");
  syncWorkflowSummaries(db);
  return { instance };
}

function markNodeSuccess(node) {
  node.status = "已成功";
  node.error = "";
}

function markNodeFailed(node, message) {
  node.status = "失败";
  node.error = message || "节点执行失败";
}

function advanceWorkflow(db, instanceId, helpers) {
  const instance = (db.workflowInstances || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Workflow not found" };
  if (["已成功", "已暂停"].includes(instance.status)) return { instance, done: true };

  const node = getActiveNode(instance);
  if (!node) {
    instance.status = "已成功";
    instance.updatedAt = helpers.formatNow();
    syncWorkflowSummaries(db);
    return { instance, done: true };
  }

  const product = (db.products || []).find((item) => item.id === instance.productId);
  if (!product) return { error: "Product not found" };

  if (node.type === "generate") {
    if (materialReady(product, node.kind)) {
      markNodeSuccess(node);
      instance.updatedAt = helpers.formatNow();
      syncWorkflowSummaries(db);
      return advanceWorkflow(db, instanceId, helpers);
    }
    if (materialGenerating(product, node.kind)) {
      node.status = "执行中";
      instance.status = "执行中";
      instance.updatedAt = helpers.formatNow();
      syncWorkflowSummaries(db);
      return { instance, waiting: true };
    }
    const task = helpers.createGenerationTask(db, product, node.kind, defaultGenerationParams(node.kind, product));
    helpers.scheduleGenerationTask(task.id);
    node.status = "执行中";
    node.taskId = task.id;
    instance.status = "执行中";
    instance.updatedAt = helpers.formatNow();
    syncWorkflowSummaries(db);
    return { instance, waiting: true };
  }

  if (node.type === "manual") {
    node.status = "等待确认";
    instance.status = "等待确认";
    instance.updatedAt = helpers.formatNow();
    helpers.addLog(db, product.id, `[流程] 等待预览确认（${instance.id}）`, "workflow");
    syncWorkflowSummaries(db);
    return { instance, waitingConfirm: true };
  }

  if (node.type === "publish") {
    try {
      if (product.stock === 0) throw new Error("库存为 0，无法创建发布任务");
      const asset = helpers.pickPublishAsset ? helpers.pickPublishAsset(db, product) : null;
      node.taskIds = [];
      const accounts =
        instance.options?.multiAccount && helpers.getContentAccounts
          ? helpers.getContentAccounts(db, product)
          : [helpers.getDefaultAccount ? helpers.getDefaultAccount(db, product, {}) : null].filter(Boolean);

      if (!accounts.length) throw new Error("无可用内容账号，请先绑定");

      accounts.forEach((account) => {
        const task = helpers.createPublishTask(
          db,
          product,
          {
            accountId: account.id,
            assetId: asset?.id || "",
            mode: "半自动",
            workflowId: instance.id,
          },
          asset
        );
        node.taskIds.push(task.id);
      });

      markNodeSuccess(node);
      instance.updatedAt = helpers.formatNow();
      helpers.addLog(
        db,
        product.id,
        `[流程] 已创建 ${node.taskIds.length} 个发布任务（${instance.id}）`,
        "workflow"
      );
      syncWorkflowSummaries(db);
      return advanceWorkflow(db, instanceId, helpers);
    } catch (error) {
      markNodeFailed(node, error.message);
      instance.status = "失败";
      instance.updatedAt = helpers.formatNow();
      syncWorkflowSummaries(db);
      return { instance, failed: true, error: error.message };
    }
  }

  if (node.type === "listing") {
    try {
      if (product.stock === 0) throw new Error("库存为 0，无法创建上架草稿");
      const task = helpers.createListingTask(db, product, { workflowId: instance.id }, helpers);
      node.taskId = task.id;
      markNodeSuccess(node);
      instance.updatedAt = helpers.formatNow();
      helpers.addLog(db, product.id, `[流程] 已创建上架草稿（${task.id}）`, "workflow");
      syncWorkflowSummaries(db);
      return advanceWorkflow(db, instanceId, helpers);
    } catch (error) {
      markNodeFailed(node, error.message);
      instance.status = "失败";
      instance.updatedAt = helpers.formatNow();
      syncWorkflowSummaries(db);
      return { instance, failed: true, error: error.message };
    }
  }

  if (node.type === "auto_listing") {
    if (!instance.options?.autoExecute) {
      markNodeSuccess(node);
      instance.updatedAt = helpers.formatNow();
      syncWorkflowSummaries(db);
      return advanceWorkflow(db, instanceId, helpers);
    }
    const listing = (db.listingTasks || []).find(
      (item) =>
        item.productId === product.id &&
        ["草稿中", "待补充", "库存预警"].includes(item.status)
    );
    if (!listing) {
      markNodeSuccess(node);
      syncWorkflowSummaries(db);
      return advanceWorkflow(db, instanceId, helpers);
    }
    const result = helpers.executeListingTask(db, listing.id, helpers);
    if (result.error && !result.task) {
      markNodeFailed(node, result.error);
      instance.status = "失败";
      instance.updatedAt = helpers.formatNow();
      syncWorkflowSummaries(db);
      return { instance, failed: true, error: result.error };
    }
    if (result.task?.status === "失败") {
      markNodeFailed(node, result.task.failureReason || result.error || "上架失败");
      instance.status = "失败";
      instance.updatedAt = helpers.formatNow();
      syncWorkflowSummaries(db);
      return { instance, failed: true, error: result.task.failureReason };
    }
    markNodeSuccess(node);
    instance.updatedAt = helpers.formatNow();
    syncWorkflowSummaries(db);
    return advanceWorkflow(db, instanceId, helpers);
  }

  if (node.type === "auto_publish") {
    if (!instance.options?.autoExecute) {
      markNodeSuccess(node);
      instance.status = "已成功";
      instance.updatedAt = helpers.formatNow();
      syncWorkflowSummaries(db);
      return { instance, done: true };
    }
    const publishNode = instance.nodes.find((item) => item.type === "publish");
    const taskIds =
      publishNode?.taskIds?.length > 0
        ? publishNode.taskIds
        : (db.publishTasks || [])
            .filter((item) => item.productId === product.id && item.status === "待发布")
            .map((item) => item.id);

    if (!taskIds.length) {
      markNodeFailed(node, "没有待执行的发布任务");
      instance.status = "失败";
      instance.updatedAt = helpers.formatNow();
      syncWorkflowSummaries(db);
      return { instance, failed: true, error: node.error };
    }

    let failed = 0;
    taskIds.forEach((taskId) => {
      const result = helpers.executePublishTask(db, taskId, helpers);
      if (result.error || result.task?.status === "失败") failed += 1;
    });

    if (failed === taskIds.length) {
      markNodeFailed(node, `${failed} 个发布任务全部失败`);
      instance.status = "失败";
      instance.updatedAt = helpers.formatNow();
      syncWorkflowSummaries(db);
      return { instance, failed: true, error: node.error };
    }

    markNodeSuccess(node);
    instance.status = failed > 0 ? "等待确认" : "已成功";
    if (failed > 0) {
      node.error = `${failed}/${taskIds.length} 个账号发布失败，可在发布中心重试`;
      instance.status = "失败";
    }
    instance.updatedAt = helpers.formatNow();
    helpers.addLog(
      db,
      product.id,
      `[流程] 自动发布完成（成功 ${taskIds.length - failed}/${taskIds.length}）`,
      "workflow"
    );
    syncWorkflowSummaries(db);
    return { instance, done: failed === 0, partial: failed > 0 && failed < taskIds.length };
  }

  return { instance };
}

function onGenerationComplete(db, productId, kind, helpers) {
  const instances = (db.workflowInstances || []).filter(
    (item) => item.productId === productId && ["执行中", "等待确认"].includes(item.status)
  );
  instances.forEach((instance) => {
    const node = getActiveNode(instance);
    if (!node || node.type !== "generate" || node.kind !== kind) return;
    if (node.status !== "执行中") return;
    markNodeSuccess(node);
    instance.updatedAt = helpers.formatNow();
    advanceWorkflow(db, instance.id, helpers);
  });
  syncWorkflowSummaries(db);
}

function onGenerationFailed(db, productId, kind, message, helpers) {
  const instances = (db.workflowInstances || []).filter(
    (item) => item.productId === productId && item.status === "执行中"
  );
  instances.forEach((instance) => {
    const node = getActiveNode(instance);
    if (!node || node.type !== "generate" || node.kind !== kind) return;
    markNodeFailed(node, message);
    instance.status = "失败";
    instance.updatedAt = helpers.formatNow();
    helpers.addLog(db, productId, `[流程] 节点失败：${node.label}（${message}）`, "workflow");
  });
  syncWorkflowSummaries(db);
}

function confirmWorkflow(db, instanceId, helpers) {
  const instance = (db.workflowInstances || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Workflow not found" };
  const node = getActiveNode(instance);
  if (!node || node.type !== "manual" || node.status !== "等待确认") {
    return { error: "当前节点不需要确认" };
  }
  markNodeSuccess(node);
  instance.status = "执行中";
  instance.updatedAt = helpers.formatNow();
  helpers.addLog(db, instance.productId, `[流程] 用户已确认预览，继续执行（${instance.id}）`, "workflow");
  syncWorkflowSummaries(db);
  return advanceWorkflow(db, instanceId, helpers);
}

function retryWorkflowNode(db, instanceId, helpers) {
  const instance = (db.workflowInstances || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Workflow not found" };
  const node = getActiveNode(instance);
  if (!node || node.status !== "失败") return { error: "没有可重试的失败节点" };
  node.status = "待执行";
  node.error = "";
  node.taskId = "";
  instance.status = "执行中";
  instance.updatedAt = helpers.formatNow();
  syncWorkflowSummaries(db);
  return advanceWorkflow(db, instanceId, helpers);
}

function skipWorkflowNode(db, instanceId, helpers) {
  const instance = (db.workflowInstances || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Workflow not found" };
  const node = getActiveNode(instance);
  if (!node) return { error: "No active node" };
  node.status = "已跳过";
  node.error = "";
  instance.status = "执行中";
  instance.updatedAt = helpers.formatNow();
  helpers.addLog(db, instance.productId, `[流程] 已跳过节点「${node.label}」（${instance.id}）`, "workflow");
  syncWorkflowSummaries(db);
  return advanceWorkflow(db, instanceId, helpers);
}

function getProductWorkflow(db, productId) {
  return (db.workflowInstances || []).find(
    (item) => item.productId === productId && ["执行中", "等待确认", "失败"].includes(item.status)
  );
}

function cancelWorkflow(db, instanceId, helpers) {
  const instance = (db.workflowInstances || []).find((item) => item.id === instanceId);
  if (!instance) return { error: "Workflow not found" };
  if (instance.status === "已成功") return { error: "已完成的流程无法取消" };
  instance.status = "已取消";
  instance.updatedAt = helpers.formatNow();
  instance.nodes.forEach((node) => {
    if (!["已成功", "已跳过"].includes(node.status)) node.status = "已跳过";
  });
  helpers.addLog(db, instance.productId, `[流程] 已取消（${instance.id}）`, "workflow");
  syncWorkflowSummaries(db);
  return { instance };
}

function batchCreateWorkflows(db, productIds, templateName, helpers, options = {}) {
  const started = [];
  const skipped = [];
  (productIds || []).forEach((productId) => {
    const result = createWorkflowInstance(db, productId, templateName, helpers, options);
    if (result.error) {
      skipped.push({ productId, reason: result.error });
      return;
    }
    advanceWorkflow(db, result.instance.id, helpers);
    started.push(result.instance.id);
  });
  return { started, skipped, count: started.length };
}

module.exports = {
  WORKFLOW_TEMPLATES,
  listWorkflowTemplates,
  syncWorkflowSummaries,
  createWorkflowInstance,
  advanceWorkflow,
  onGenerationComplete,
  onGenerationFailed,
  confirmWorkflow,
  retryWorkflowNode,
  skipWorkflowNode,
  cancelWorkflow,
  batchCreateWorkflows,
  getProductWorkflow,
  getActiveNode,
  computeWorkflowProgress,
};
