// 模特图库仓储(全局,不绑定商品)。换装生图时选一张作 node41 模特图。
const { getPrisma } = require("./client");

function list() {
  return getPrisma().modelImage.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

function getById(id) {
  return getPrisma().modelImage.findUnique({ where: { id } });
}

function create(data) {
  return getPrisma().modelImage.create({ data });
}

function softDelete(id) {
  return getPrisma().modelImage.update({ where: { id }, data: { deletedAt: new Date() } });
}

module.exports = { list, getById, create, softDelete };
