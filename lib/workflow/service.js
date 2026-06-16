// 工作流引擎服务:编排「链定义 + 状态机 + 仓储持久化」。后端端点只调这里。
const productRepo = require("../repositories/product.repo");
const workflowRepo = require("../repositories/workflow.repo");
const { buildNodeRows, listTemplates } = require("./chains");
const {
  initializeNodes,
  applyAction,
  currentNodeId,
  computeWorkflowStatus,
  progress,
} = require("./machine");

const ACTIONS = ["execute", "confirm", "skip", "retry"];

function templates() {
  return listTemplates();
}

async function getWorkflow(id) {
  const wf = await workflowRepo.getById(id);
  if (!wf) return null;
  return { ...wf, progress: progress(wf.nodes) };
}

async function getForProduct(productId) {
  const list = await workflowRepo.getByProduct(productId);
  return list.map((wf) => ({ ...wf, progress: progress(wf.nodes) }));
}

// 为某商品的某平台创建工作流(初始化节点状态:商品资料已完成、下一节点激活)。
async function createForProduct(productId, platform) {
  const rows = buildNodeRows(platform);
  if (!rows) throw new Error(`不支持的平台:${platform}`);

  const product = await productRepo.getById(productId);
  if (!product) throw new Error("商品不存在");

  const active = (await workflowRepo.getByProduct(productId)).find(
    (w) => w.platform === platform && w.status !== "已完成"
  );
  if (active) throw new Error(`该商品已有进行中的「${platform}」工作流`);

  const nodes = initializeNodes(rows); // 设置初始状态
  const wf = await workflowRepo.createWorkflow({
    productId,
    platform,
    template: `${platform}链路`,
    nodes,
  });

  // 节点入库后拿到真实 id,回写当前节点与工作流状态
  await workflowRepo.updateWorkflow(wf.id, {
    currentNodeId: currentNodeId(wf.nodes),
    status: computeWorkflowStatus(wf.nodes),
  });
  return getWorkflow(wf.id);
}

// 对工作流中某节点施加动作(execute/confirm/skip/retry),持久化变更。
async function act(workflowId, nodeId, actionType) {
  if (!ACTIONS.includes(actionType)) throw new Error(`未知操作:${actionType}`);
  const wf = await workflowRepo.getById(workflowId);
  if (!wf) throw new Error("工作流不存在");

  const before = wf.nodes;
  const after = applyAction(before, { type: actionType, nodeId }); // 非法转移会抛错

  const changed = after.filter(
    (n, i) => n.status !== before[i].status || (n.error || "") !== (before[i].error || "")
  );
  if (changed.length) {
    await workflowRepo.updateNodes(
      changed.map((n) => ({ id: n.id, status: n.status, error: n.error }))
    );
  }
  await workflowRepo.updateWorkflow(workflowId, {
    currentNodeId: currentNodeId(after),
    status: computeWorkflowStatus(after),
  });
  return getWorkflow(workflowId);
}

module.exports = { templates, getWorkflow, getForProduct, createForProduct, act };
