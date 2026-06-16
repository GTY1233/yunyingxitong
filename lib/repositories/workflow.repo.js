// 平台工作流 + 节点仓储。节点状态是流程的唯一真相源。
const { getPrisma } = require("./client");

function getByProduct(productId) {
  return getPrisma().platformWorkflow.findMany({
    where: { productId, deletedAt: null },
    include: { nodes: { orderBy: { seq: "asc" } } },
  });
}

function getById(id) {
  return getPrisma().platformWorkflow.findUnique({
    where: { id },
    include: { nodes: { orderBy: { seq: "asc" } } },
  });
}

/** 推进/回退某节点状态（受控 7 态）。写操作集中于此，便于将来加事务与校验。 */
function updateNodeStatus(nodeId, status, error) {
  return getPrisma().workflowNode.update({
    where: { id: nodeId },
    data: { status, error: error || null },
  });
}

module.exports = { getByProduct, getById, updateNodeStatus };
