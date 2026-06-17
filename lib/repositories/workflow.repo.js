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

/** 创建工作流实例 + 节点（一次性嵌套创建）。 */
function createWorkflow({ productId, platform, template, nodes }) {
  return getPrisma().platformWorkflow.create({
    data: { productId, platform, template, status: "执行中", nodes: { create: nodes } },
    include: { nodes: { orderBy: { seq: "asc" } } },
  });
}

function updateWorkflow(id, data) {
  return getPrisma().platformWorkflow.update({ where: { id }, data });
}

/** 推进/回退某节点状态（受控 7 态）。 */
function updateNodeStatus(nodeId, status, error) {
  return getPrisma().workflowNode.update({
    where: { id: nodeId },
    data: { status, error: error || null },
  });
}

/** 查所有「执行中」节点（进程重启恢复用）。 */
function findRunningNodes() {
  return getPrisma().workflowNode.findMany({
    where: { status: "执行中", deletedAt: null },
    select: { id: true, workflowId: true },
  });
}

/** 批量更新节点状态（单事务，保证一致）。 */
function updateNodes(list) {
  const prisma = getPrisma();
  return prisma.$transaction(
    list.map((n) =>
      prisma.workflowNode.update({
        where: { id: n.id },
        data: { status: n.status, error: n.error || null },
      })
    )
  );
}

module.exports = {
  getByProduct,
  getById,
  createWorkflow,
  updateWorkflow,
  updateNodeStatus,
  updateNodes,
  findRunningNodes,
};
