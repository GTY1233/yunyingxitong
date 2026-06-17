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
const { executeGenerateNode } = require("./executors");

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

async function persist(workflowId, before, after) {
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
}

// 后台执行一个生成节点:跑执行器(可能很久,如视频 ~1000s),完成后回写终态。
// 完成时重新加载工作流再施加终态转移,避免与并发操作产生陈旧状态。永不抛出(后台任务)。
async function runNodeJob(workflowId, nodeId) {
  try {
    const wf = await workflowRepo.getById(workflowId);
    if (!wf) return;
    const node = wf.nodes.find((n) => n.id === nodeId);
    const product = await productRepo.getById(wf.productId);
    let result;
    try {
      result = await executeGenerateNode(node, product);
    } catch (e) {
      result = { ok: false, error: e.message };
    }
    const fresh = await workflowRepo.getById(workflowId);
    if (!fresh) return;
    const after = result.ok
      ? applyAction(fresh.nodes, { type: "complete", nodeId })
      : applyAction(fresh.nodes, { type: "fail", nodeId, error: result.error });
    await persist(workflowId, fresh.nodes, after);
  } catch (e) {
    console.error("[workflow] 节点后台回写失败:", e.message);
  }
}

// 对节点施加动作。execute:先置「执行中」,后台跑真实生成(成功→已成功、失败→失败),HTTP 立即返回;
// confirm/skip/retry 同步。opts.sync=true 时等待后台任务完成(供测试确定性)。
async function act(workflowId, nodeId, actionType, opts = {}) {
  if (!ACTIONS.includes(actionType)) throw new Error(`未知操作:${actionType}`);
  const wf = await workflowRepo.getById(workflowId);
  if (!wf) throw new Error("工作流不存在");
  const node = wf.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error("节点不存在");

  if (actionType === "execute") {
    const after = applyAction(wf.nodes, { type: "start", nodeId }); // 可执行→执行中(含类型/状态校验)
    await persist(workflowId, wf.nodes, after);
    const job = runNodeJob(workflowId, nodeId); // 后台,不阻塞响应
    if (opts.sync) await job;
    return getWorkflow(workflowId);
  }

  const after = applyAction(wf.nodes, { type: actionType, nodeId });
  await persist(workflowId, wf.nodes, after);
  return getWorkflow(workflowId);
}

// 进程重启后,残留「执行中」节点的后台任务已丢失 → 重置为「失败」(可重试),并修正其工作流状态。
async function recoverStuckNodes() {
  const stuck = await workflowRepo.findRunningNodes();
  if (!stuck.length) return 0;
  await workflowRepo.updateNodes(
    stuck.map((n) => ({ id: n.id, status: "失败", error: "服务重启中断,请重试" }))
  );
  const wfIds = [...new Set(stuck.map((n) => n.workflowId))];
  for (const id of wfIds) {
    const wf = await workflowRepo.getById(id);
    if (wf) {
      await workflowRepo.updateWorkflow(id, {
        status: computeWorkflowStatus(wf.nodes),
        currentNodeId: currentNodeId(wf.nodes),
      });
    }
  }
  return stuck.length;
}

module.exports = {
  templates,
  getWorkflow,
  getForProduct,
  createForProduct,
  act,
  runNodeJob,
  recoverStuckNodes,
};
