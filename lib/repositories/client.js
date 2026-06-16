// Prisma 客户端单例 + .env 加载（DATABASE_URL）。
// 仓储层是数据访问的唯一入口；应用其余部分只调各 repo 的领域函数，不直接 import @prisma/client。
const fs = require("node:fs");
const path = require("node:path");

const envPath = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

const { PrismaClient } = require("@prisma/client");

let prisma = null;

/** @returns {import("@prisma/client").PrismaClient} 进程级单例 */
function getPrisma() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

async function disconnect() {
  if (prisma) await prisma.$disconnect();
}

module.exports = { getPrisma, disconnect };
