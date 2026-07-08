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
  TERMINAL,
  SIDE_EFFECT,
} = require("./machine");
const { autoParamsForNode } = require("./auto-params");
const { getRunStage, clearRunStage } = require("./run-stage");
const { executeGenerateNode } = require("./executors");

const ACTIONS = ["execute", "confirm", "skip", "retry", "rearm"];

// 正在执行的节点集合:防双击/并发重复触发(RunningHub 生成是计费副作用)。单进程内存即可。
const inFlight = new Set();

function parseMeta(meta) {
  try {
    return JSON.parse(meta || "{}");
  } catch {
    return {};
  }
}

function templates() {
  return listTemplates();
}

// 给节点补前端要用的派生字段:optional(可选,从 meta)+ runStage(排队中/生成中,内存态)。
function decorate(wf) {
  return {
    ...wf,
    progress: progress(wf.nodes),
    nodes: wf.nodes.map((n) => ({
      ...n,
      optional: !!parseMeta(n.meta).optional,
      runStage: n.status === "执行中" ? getRunStage(n.id) : "",
    })),
  };
}

async function getWorkflow(id) {
  const wf = await workflowRepo.getById(id);
  if (!wf) return null;
  return decorate(wf);
}

async function getForProduct(productId) {
  const list = await workflowRepo.getByProduct(productId);
  return list.map((wf) => decorate(wf));
}

// 为某商品的某平台创建工作流(初始化节点状态:商品资料已完成、下一节点激活)。
// opts.autoMode=true:自动流水线——节点成功后自动推进,只停在「待确认/失败」等人;创建即开跑。
async function createForProduct(productId, platform, opts = {}) {
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
    autoMode: !!opts.autoMode,
  });

  // 节点入库后拿到真实 id,回写当前节点与工作流状态
  await workflowRepo.updateWorkflow(wf.id, {
    currentNodeId: currentNodeId(wf.nodes),
    status: computeWorkflowStatus(wf.nodes),
  });

  if (opts.autoMode) {
    const kick = maybeAutoAdvance(wf.id, { sync: opts.sync });
    if (opts.sync) await kick;
  }
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
// 成功后若工作流开了 autoMode,自动推进下一个可执行节点(chainOpts 传递 sync/depth)。
async function runNodeJob(workflowId, nodeId, execOpts = {}, chainOpts = {}) {
  let succeeded = false;
  try {
    const wf = await workflowRepo.getById(workflowId);
    if (!wf) return;
    const node = wf.nodes.find((n) => n.id === nodeId);
    const product = await productRepo.getById(wf.productId);
    let result;
    try {
      result = await executeGenerateNode(node, product, execOpts, wf.platform);
    } catch (e) {
      result = { ok: false, error: e.message };
    }
    const fresh = await workflowRepo.getById(workflowId);
    if (!fresh) return;
    const after = result.ok
      ? applyAction(fresh.nodes, { type: "complete", nodeId })
      : applyAction(fresh.nodes, { type: "fail", nodeId, error: result.error });
    await persist(workflowId, fresh.nodes, after);
    succeeded = result.ok;
  } catch (e) {
    console.error("[workflow] 节点后台回写失败:", e.message);
  } finally {
    inFlight.delete(nodeId);
    clearRunStage(nodeId); // 任务结束,清掉「排队中/生成中」子状态
  }
  if (succeeded) {
    const next = maybeAutoAdvance(workflowId, {
      sync: chainOpts.sync,
      depth: (chainOpts.depth || 0) + 1,
    });
    if (chainOpts.sync) await next;
  }
}

// 自动推进:autoMode 工作流的当前节点若「可执行」,自动带上自动选参执行之。
// 停机条件:待确认(等人审核)/ 失败(等人重试)/ 已完成 / 未开自动 / 深度护栏。永不抛出。
async function maybeAutoAdvance(workflowId, opts = {}) {
  const depth = opts.depth || 0;
  if (depth > 30) {
    console.error("[workflow] 自动推进达到深度护栏,停止:", workflowId);
    return;
  }
  try {
    const wf = await workflowRepo.getById(workflowId);
    if (!wf?.autoMode) return;
    const node = wf.nodes.find((n) => !TERMINAL.includes(n.status));
    if (!node) return;
    // 可选的观测/占位节点(授权号/精选联盟/数据回流)在自动模式下自动跳过,不卡审核。
    if (node.status === "待确认" && parseMeta(node.meta).optional) {
      await act(workflowId, node.id, "skip", { sync: opts.sync }); // skip 后 act 会再触发续跑
      return;
    }
    if (node.status !== "可执行" || !SIDE_EFFECT.includes(node.type)) return;
    if (inFlight.has(node.id)) return;
    const autoParams = await autoParamsForNode(node); // 模特图/参考视频自动轮换
    await act(workflowId, node.id, "execute", { ...autoParams, sync: opts.sync, __depth: depth });
  } catch (e) {
    console.error("[workflow] 自动推进中止:", e.message);
  }
}

// 对节点施加动作。execute:先置「执行中」,后台跑真实生成(成功→已成功、失败→失败),HTTP 立即返回;
// confirm/skip/retry 同步,且 autoMode 下确认/重试后自动续跑。opts.sync=true 等待后台任务(测试确定性)。
async function act(workflowId, nodeId, actionType, opts = {}) {
  if (!ACTIONS.includes(actionType)) throw new Error(`未知操作:${actionType}`);
  const wf = await workflowRepo.getById(workflowId);
  if (!wf) throw new Error("工作流不存在");
  const node = wf.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error("节点不存在");

  if (actionType === "execute") {
    if (inFlight.has(nodeId)) throw new Error(`节点「${node.label}」正在执行,请勿重复触发`);
    const after = applyAction(wf.nodes, { type: "start", nodeId }); // 可执行→执行中(含类型/状态校验)
    inFlight.add(nodeId); // 校验通过立刻上锁(与检查同一事件循环轮次,原子)
    try {
      await persist(workflowId, wf.nodes, after);
    } catch (e) {
      inFlight.delete(nodeId);
      throw e;
    }
    // genParams:模特图/提示词/生成条数/参考视频/视频微调参数等(去掉链路控制键)
    const { sync, __depth, ...genParams } = opts;
    const job = runNodeJob(workflowId, nodeId, genParams, { sync, depth: __depth || 0 });
    if (sync) await job;
    return getWorkflow(workflowId);
  }

  const after = applyAction(wf.nodes, { type: actionType, nodeId });
  await persist(workflowId, wf.nodes, after);
  // 确认/跳过/重试后:autoMode 工作流自动续跑(重试把失败节点拉回可执行,正好被接住)
  if (["confirm", "skip", "retry"].includes(actionType)) {
    const next = maybeAutoAdvance(workflowId, { sync: opts.sync });
    if (opts.sync) await next;
  }
  return getWorkflow(workflowId);
}

// 开/关自动流水线;开启时立即尝试推进当前节点。
async function setAutoMode(workflowId, enable, opts = {}) {
  const wf = await workflowRepo.getById(workflowId);
  if (!wf) throw new Error("工作流不存在");
  await workflowRepo.updateWorkflow(workflowId, { autoMode: !!enable });
  if (enable) {
    const kick = maybeAutoAdvance(workflowId, { sync: opts.sync });
    if (opts.sync) await kick;
  }
  return getWorkflow(workflowId);
}

// 审核队列:所有活跃工作流中等人处理的节点(待确认=审核点,失败=需重试),一站式收件箱。
async function reviewQueue() {
  const rows = await workflowRepo.findReviewNodes();
  const items = rows.map((n) => {
    let hint = "";
    try {
      hint = JSON.parse(n.meta || "{}").hint || "";
    } catch {}
    return {
      nodeId: n.id,
      workflowId: n.workflow.id,
      platform: n.workflow.platform,
      autoMode: n.workflow.autoMode,
      productId: n.workflow.product.id,
      productName: n.workflow.product.name,
      displayCode: n.workflow.product.displayCode || "",
      nodeLabel: n.label,
      nodeType: n.type,
      kind: n.kind || "",
      status: n.status,
      error: n.error || "",
      hint,
      updatedAt: n.updatedAt,
    };
  });
  return {
    items,
    counts: {
      pending: items.filter((i) => i.status === "待确认").length,
      failed: items.filter((i) => i.status === "失败").length,
    },
  };
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
  setAutoMode,
  reviewQueue,
  runNodeJob,
  recoverStuckNodes,
};
