// 生成节点的「运行子状态」内存态:RunningHub 的 QUEUED(排队中)/RUNNING(生成中)。
// 我们系统的节点态只有「执行中」,这里补一层子状态给前端显示。纯内存(进程重启即清,无所谓:
// 残留「执行中」节点重启会被 recoverStuckNodes 重置),不落库、不产生 DB 写。
const stageByNode = new Map();

const LABEL = { QUEUED: "排队中", RUNNING: "生成中" };

function setRunStage(nodeId, status) {
  if (!nodeId) return;
  stageByNode.set(nodeId, LABEL[status] || "生成中");
}

function getRunStage(nodeId) {
  return stageByNode.get(nodeId) || "";
}

function clearRunStage(nodeId) {
  stageByNode.delete(nodeId);
}

module.exports = { setRunStage, getRunStage, clearRunStage };
