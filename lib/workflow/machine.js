// 工作流显式状态机(纯逻辑,无 DB,可单测)。
// 7 态:未开始 / 可执行 / 执行中 / 待确认 / 已成功 / 失败 / 已跳过
const STATUS = {
  IDLE: "未开始",
  READY: "可执行",
  RUNNING: "执行中",
  WAIT: "待确认",
  DONE: "已成功",
  FAILED: "失败",
  SKIPPED: "已跳过",
};
const TERMINAL = [STATUS.DONE, STATUS.SKIPPED];
const SIDE_EFFECT = ["generate", "listing", "publish"]; // 有副作用、可执行/可重试
const HUMAN = ["manual", "observe"]; // 需人工确认/等待

// 节点初次激活时的状态(由类型决定):副作用→可执行;人工/观测→待确认。
function initialActiveStatus(type) {
  return HUMAN.includes(type) ? STATUS.WAIT : STATUS.READY;
}

// 初始化一条工作流的节点:商品资料默认已完成,激活下一个节点。
function initializeNodes(nodes) {
  const list = nodes.map((n) => ({ ...n, status: STATUS.IDLE }));
  const info = list.find((n) => n.nodeKey === "product_info");
  if (info) info.status = STATUS.DONE;
  const next = list.find((n) => n.status === STATUS.IDLE);
  if (next) next.status = initialActiveStatus(next.type);
  return list;
}

// 激活下一个「未开始」节点(线性链,单活动节点)。
function activateNext(list) {
  const next = list.find((n) => n.status === STATUS.IDLE);
  if (next) next.status = initialActiveStatus(next.type);
}

function currentNodeId(list) {
  const cur = list.find((n) => !TERMINAL.includes(n.status));
  return cur ? cur.id : null;
}

function computeWorkflowStatus(list) {
  if (list.every((n) => TERMINAL.includes(n.status))) return "已完成";
  const cur = list.find((n) => !TERMINAL.includes(n.status));
  if (cur && cur.status === STATUS.FAILED) return "失败";
  if (cur && cur.status === STATUS.WAIT) return "等待确认";
  return "执行中";
}

// 计算进度百分比(已成功+已跳过 占比)。
function progress(list) {
  if (!list.length) return 0;
  const done = list.filter((n) => TERMINAL.includes(n.status)).length;
  return Math.round((done / list.length) * 100);
}

// 对某节点施加一个动作,返回新的节点数组(纯函数,不改原数组)。非法转移抛错。
// action: { type: "execute"|"confirm"|"skip"|"retry"|"fail", nodeId, error? }
function applyAction(nodes, action) {
  const list = nodes.map((n) => ({ ...n }));
  const node = list.find((n) => n.id === action.nodeId);
  if (!node) throw new Error("节点不存在");

  switch (action.type) {
    case "execute":
      if (node.status !== STATUS.READY)
        throw new Error(`节点「${node.label}」当前不可执行(${node.status})`);
      if (!SIDE_EFFECT.includes(node.type)) throw new Error(`节点「${node.label}」非可执行类型`);
      node.status = STATUS.DONE; // 演示:直接成功(真实生成/上架对接后改为投递任务)
      node.error = "";
      activateNext(list);
      break;
    case "confirm":
      if (node.status !== STATUS.WAIT)
        throw new Error(`节点「${node.label}」当前无需确认(${node.status})`);
      node.status = STATUS.DONE;
      node.error = "";
      activateNext(list);
      break;
    case "skip":
      if (TERMINAL.includes(node.status)) throw new Error(`节点「${node.label}」已结束,不可跳过`);
      node.status = STATUS.SKIPPED;
      node.error = "";
      activateNext(list);
      break;
    case "retry":
      if (node.status !== STATUS.FAILED)
        throw new Error(`仅失败节点可重试(${node.label}:${node.status})`);
      node.status = initialActiveStatus(node.type);
      node.error = "";
      break;
    case "rearm": // 重新生成:已成功/失败/已跳过的生成节点 → 可重新执行(跳过的也能反悔重生成)
      if (![STATUS.DONE, STATUS.FAILED, STATUS.SKIPPED].includes(node.status))
        throw new Error(`节点「${node.label}」当前无需重置(${node.status})`);
      if (!SIDE_EFFECT.includes(node.type)) throw new Error(`节点「${node.label}」不可重新生成`);
      node.status = STATUS.READY;
      node.error = "";
      break;
    case "start":
      if (node.status !== STATUS.READY)
        throw new Error(`节点「${node.label}」当前不可执行(${node.status})`);
      if (!SIDE_EFFECT.includes(node.type)) throw new Error(`节点「${node.label}」非可执行类型`);
      node.status = STATUS.RUNNING; // 进入「执行中」,实际生成在后台跑
      node.error = "";
      break;
    case "complete":
      if (node.status !== STATUS.RUNNING)
        throw new Error(`节点「${node.label}」未在执行中(${node.status})`);
      node.status = STATUS.DONE;
      node.error = "";
      activateNext(list);
      break;
    case "fail":
      node.status = STATUS.FAILED;
      node.error = action.error || "执行失败";
      break;
    default:
      throw new Error(`未知操作:${action.type}`);
  }

  return list;
}

module.exports = {
  STATUS,
  TERMINAL,
  SIDE_EFFECT,
  initialActiveStatus,
  initializeNodes,
  applyAction,
  currentNodeId,
  computeWorkflowStatus,
  progress,
};
