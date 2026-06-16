// 派生状态：商品的图/文/视频/上架/发布状态不再落库，统一从资产/任务派生。
// 这是「状态单一真相源」的落地——结构上杜绝旧库 P1025/P1022 式分叉。
const { getPrisma } = require("./client");

const READY = ["已生成", "已发布", "已加入发布"];

/** 由资产派生某商品的素材状态。 */
async function deriveProductMediaStatus(productId) {
  const assets = await getPrisma().asset.findMany({
    where: { productId, deletedAt: null },
    select: { kind: true, status: true },
  });
  const has = (kind) => assets.some((a) => a.kind === kind && READY.includes(a.status));
  return {
    imageStatus: has("image") ? "已生成" : "未生成",
    copyStatus: has("copy") ? "已生成" : "未生成",
    videoStatus: has("video") ? "已生成" : "未生成",
  };
}

/** 由工作流节点派生进度（已成功/已跳过的节点占比；已跳过不计入“完成质量”但计入推进）。 */
async function deriveWorkflowProgress(workflowId) {
  const nodes = await getPrisma().workflowNode.findMany({
    where: { workflowId },
    select: { status: true },
  });
  if (!nodes.length) return 0;
  const done = nodes.filter((n) => ["已成功", "已跳过"].includes(n.status)).length;
  return Math.round((done / nodes.length) * 100);
}

module.exports = { deriveProductMediaStatus, deriveWorkflowProgress };
