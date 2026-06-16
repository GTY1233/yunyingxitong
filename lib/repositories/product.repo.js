// 商品仓储。所有商品的读写唯一入口；写操作走 Prisma 事务/约束。
const { getPrisma } = require("./client");

function list() {
  return getPrisma().product.findMany({
    where: { deletedAt: null },
    orderBy: { displayCode: "asc" },
  });
}

function getById(id) {
  return getPrisma().product.findUnique({ where: { id } });
}

function getByDisplayCode(displayCode) {
  return getPrisma().product.findFirst({ where: { displayCode } });
}

function getWithRelations(id) {
  return getPrisma().product.findUnique({
    where: { id },
    include: {
      assets: { where: { deletedAt: null } },
      productMappings: true,
      workflows: { include: { nodes: { orderBy: { seq: "asc" } } } },
    },
  });
}

function create(data) {
  return getPrisma().product.create({ data });
}

function update(id, data) {
  return getPrisma().product.update({ where: { id }, data });
}

function softDelete(id) {
  return getPrisma().product.update({ where: { id }, data: { deletedAt: new Date() } });
}

module.exports = { list, getById, getByDisplayCode, getWithRelations, create, update, softDelete };
