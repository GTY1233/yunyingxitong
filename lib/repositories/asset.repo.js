// 成品（图/文/视频）仓储。
const { getPrisma } = require("./client");

function listByProduct(productId, kind) {
  return getPrisma().asset.findMany({
    where: { productId, deletedAt: null, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "asc" },
  });
}

function create(data) {
  return getPrisma().asset.create({ data });
}

/** 设为主图：同商品同类先全部取消 isPrimary，再设目标为主，单事务保证一致。 */
function setPrimary(assetId, productId) {
  const prisma = getPrisma();
  return prisma.$transaction([
    prisma.asset.updateMany({ where: { productId, kind: "image" }, data: { isPrimary: false } }),
    prisma.asset.update({ where: { id: assetId }, data: { isPrimary: true } }),
  ]);
}

module.exports = { listByProduct, create, setPrimary };
