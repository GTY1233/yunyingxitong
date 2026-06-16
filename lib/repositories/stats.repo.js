// 工作台统计：一次性算出驾驶舱要的各类计数（无 BigInt，便于 JSON 序列化）。
const { getPrisma } = require("./client");

async function dashboard() {
  const p = getPrisma();
  const [prods, accounts, byKind] = await Promise.all([
    p.product.findMany({
      where: { deletedAt: null },
      select: { stock: true, warningStock: true, status: true },
    }),
    p.account.findMany({ where: { deletedAt: null }, select: { role: true } }),
    p.asset.groupBy({ by: ["kind"], where: { deletedAt: null }, _count: true }),
  ]);

  const lowStock = prods.filter((x) => (x.stock ?? 0) <= (x.warningStock ?? 0)).length;
  const productsByStatus = {};
  for (const x of prods) {
    const k = x.status || "未知";
    productsByStatus[k] = (productsByStatus[k] || 0) + 1;
  }
  const accountsByRole = {};
  for (const a of accounts) {
    const k = a.role || "其他";
    accountsByRole[k] = (accountsByRole[k] || 0) + 1;
  }

  return {
    products: prods.length,
    lowStock,
    accounts: accounts.length,
    assets: byKind.reduce((s, k) => s + k._count, 0),
    productsByStatus,
    accountsByRole,
    assetsByKind: Object.fromEntries(byKind.map((k) => [k.kind, k._count])),
  };
}

// 工作台待办：库存预警商品 + 缺素材商品(从资产派生),供驾驶舱可操作卡片。
async function workbench() {
  const products = await getPrisma().product.findMany({
    where: { deletedAt: null },
    include: { assets: { where: { deletedAt: null }, select: { kind: true, status: true } } },
  });
  const READY = ["已生成", "已发布", "已加入发布"];
  const lowStock = [];
  const missingMedia = [];
  for (const p of products) {
    if ((p.stock ?? 0) <= (p.warningStock ?? 0)) {
      lowStock.push({
        id: p.id,
        displayCode: p.displayCode,
        name: p.name,
        stock: p.stock,
        warningStock: p.warningStock,
      });
    }
    const has = (k) => p.assets.some((a) => a.kind === k && READY.includes(a.status));
    const missing = ["image", "copy", "video"].filter((k) => !has(k));
    if (missing.length) {
      missingMedia.push({ id: p.id, displayCode: p.displayCode, name: p.name, missing });
    }
  }
  return { lowStock, missingMedia };
}

module.exports = { dashboard, workbench };
