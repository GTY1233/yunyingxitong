// 账号仓储（主店/授权号/达人号矩阵）。
const { getPrisma } = require("./client");

function list() {
  return getPrisma().account.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
}

function getById(id) {
  return getPrisma().account.findUnique({ where: { id } });
}

/** 按矩阵角色取号：main_shop | authorized | creator */
function byRole(role, platform) {
  return getPrisma().account.findMany({
    where: { role, deletedAt: null, ...(platform ? { platform } : {}) },
    orderBy: { name: "asc" },
  });
}

function create(data) {
  return getPrisma().account.create({ data });
}

module.exports = { list, getById, byRole, create };
