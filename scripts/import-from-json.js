// 阶段一极简导入：把「有真实媒体的商品 + 账号 + 真实图/视频/文案」从 data/db.json 导入 SQLite。
// 媒体重指向 media-backup/ 本地文件。旧的 mock 工作流/任务/日志一律不导入（进系统后用新引擎重跑）。
// 幂等：每次运行先清空目标表再插入。用法：node scripts/import-from-json.js
const fs = require("fs");
const path = require("path");

// —— 极简 .env 加载（与 server.js 同思路）——
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ROOT = path.join(__dirname, "..");
const db = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "db.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "media-backup", "manifest.json"), "utf8"));

function toLocal(p) {
  return p ? p.split(path.sep).join("/") : null;
}

async function main() {
  // 1. 目标产品集 = manifest 中出现过的 productId（有真实图/视频的商品）
  const productIds = [...new Set(manifest.filter((m) => m.localFile).map((m) => m.productId))];
  const savedAsset = new Map(manifest.filter((m) => m.localFile).map((m) => [m.assetId, toLocal(m.localFile)]));
  console.log("将导入商品:", productIds.join(", "));

  // 2. 清空（幂等，FK 安全顺序）
  await prisma.platformProductMapping.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.publishTask.deleteMany();
  await prisma.listingTask.deleteMany();
  await prisma.generationTask.deleteMany();
  await prisma.workflowNode.deleteMany();
  await prisma.platformWorkflow.deleteMany();
  await prisma.operationLog.deleteMany();
  await prisma.account.deleteMany();
  await prisma.product.deleteMany();

  // 3. 账号（全导，体量小、是矩阵配置）
  const accIdMap = new Map();
  for (const a of db.accounts || []) {
    const created = await prisma.account.create({
      data: {
        platform: a.platform || null,
        name: a.name || null,
        type: a.type || null,
        role: a.role || null,
        auth: a.auth || null,
        rule: a.rule || null,
        persona: a.persona || null,
        isDemo: Boolean(a.demo),
      },
    });
    accIdMap.set(a.id, created.id);
  }

  // 4. 商品 + 平台商品ID映射 + 资产
  let nAsset = 0;
  for (const oldId of productIds) {
    const p = (db.products || []).find((x) => x.id === oldId);
    if (!p) continue;
    const created = await prisma.product.create({
      data: {
        displayCode: p.id,
        skuCode: p.code || null,
        name: p.name,
        category: p.category || null,
        priceCents: Number.isFinite(Number(p.price)) ? Math.round(Number(p.price) * 100) : null,
        stock: Number(p.stock) || 0,
        warningStock: Number(p.warningStock) || 0,
        sellingPoints: p.sellingPoints || null,
        specs: p.specs || null,
        platforms: p.platforms ? JSON.stringify(p.platforms) : null,
        colors: p.colors ? JSON.stringify(p.colors) : null,
        status: p.status || null,
      },
    });
    const newPid = created.id;

    // 平台商品ID映射
    for (const [platform, pid] of Object.entries(p.platformProductIds || {})) {
      if (!pid) continue;
      await prisma.platformProductMapping.create({
        data: { productId: newPid, platform, externalProductId: String(pid) },
      });
    }

    // 资产：真实图/视频（重指向本地）+ 文案
    for (const a of (db.assets || []).filter((x) => x.productId === oldId)) {
      const isMedia = a.kind === "image" || a.kind === "video";
      if (isMedia && !savedAsset.has(a.id)) continue; // 跳过占位 SVG / 失效媒体
      await prisma.asset.create({
        data: {
          productId: newPid,
          kind: a.kind,
          type: a.type || null,
          name: a.name || null,
          status: a.status || null,
          usage: a.usage || null,
          version: a.version || null,
          provider: a.provider || null,
          isPrimary: Boolean(a.isPrimary),
          content: a.content || null,
          mediaUrl: isMedia ? savedAsset.get(a.id) : null,
          posterUrl: a.posterUrl || a.coverUrl || null,
          aspectRatio: a.aspectRatio || null,
          duration: a.duration || null,
        },
      });
      nAsset++;
    }
  }

  // 5. 校验
  const counts = {
    products: await prisma.product.count(),
    accounts: await prisma.account.count(),
    assets: await prisma.asset.count(),
    mappings: await prisma.platformProductMapping.count(),
  };
  console.log("\n— 导入完成 —");
  console.log(counts);
  console.log(`其中媒体资产指向本地: ${nAsset} 个`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
