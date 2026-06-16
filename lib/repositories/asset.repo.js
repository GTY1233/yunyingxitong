// 成品（图/文/视频）仓储。
const { getPrisma } = require("./client");

function listByProduct(productId, kind) {
  return getPrisma().asset.findMany({
    where: { productId, deletedAt: null, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "asc" },
  });
}

// 全量素材(带所属商品信息),供素材库页。
function listAll(kind) {
  return getPrisma().asset.findMany({
    where: { deletedAt: null, ...(kind ? { kind } : {}) },
    include: { product: { select: { displayCode: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

function create(data) {
  return getPrisma().asset.create({ data });
}

function getById(id) {
  return getPrisma().asset.findUnique({ where: { id } });
}

function softDelete(id) {
  return getPrisma().asset.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** 设为主图：同商品同类先全部取消 isPrimary，再设目标为主，单事务保证一致。 */
function setPrimary(assetId, productId) {
  const prisma = getPrisma();
  return prisma.$transaction([
    prisma.asset.updateMany({ where: { productId, kind: "image" }, data: { isPrimary: false } }),
    prisma.asset.update({ where: { id: assetId }, data: { isPrimary: true } }),
  ]);
}

module.exports = { listByProduct, listAll, getById, create, softDelete, setPrimary };
