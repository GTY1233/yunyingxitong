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

// 自动生成下一个业务编号(P####),延续导入的 P1021…序列。
async function nextDisplayCode() {
  const rows = await getPrisma().product.findMany({ select: { displayCode: true } });
  let max = 1027;
  for (const r of rows) {
    const m = /^P(\d+)$/.exec(r.displayCode || "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `P${max + 1}`;
}

async function create(data) {
  const payload = { ...data };
  if (!payload.displayCode) payload.displayCode = await nextDisplayCode();
  return getPrisma().product.create({ data: payload });
}

function update(id, data) {
  return getPrisma().product.update({ where: { id }, data });
}

function softDelete(id) {
  return getPrisma().product.update({ where: { id }, data: { deletedAt: new Date() } });
}

module.exports = { list, getById, getByDisplayCode, getWithRelations, create, update, softDelete };
