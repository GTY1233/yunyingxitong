// 仓储层统一出口。应用其余部分用 require("./lib/repositories") 取各领域仓储，
// 不直接 import @prisma/client —— 数据访问的唯一边界。
module.exports = {
  products: require("./product.repo"),
  accounts: require("./account.repo"),
  assets: require("./asset.repo"),
  workflows: require("./workflow.repo"),
  status: require("./status"),
  client: require("./client"),
};
