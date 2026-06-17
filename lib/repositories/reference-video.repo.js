// 参考视频库仓储(全局)。生视频时选一段作 node161 参考视频(决定动作/节奏)。
const { getPrisma } = require("./client");

function list() {
  return getPrisma().referenceVideo.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

function getById(id) {
  return getPrisma().referenceVideo.findUnique({ where: { id } });
}

function create(data) {
  return getPrisma().referenceVideo.create({ data });
}

function softDelete(id) {
  return getPrisma().referenceVideo.update({ where: { id }, data: { deletedAt: new Date() } });
}

module.exports = { list, getById, create, softDelete };
