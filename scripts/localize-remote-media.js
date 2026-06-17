// 一次性:把已存为远程 RunningHub 链接(24h 失效)的资产产物下载到本地 data/generated,
// 并更新 asset.mediaUrl/posterUrl 为本地地址。幂等(已是本地的跳过)。用法:node scripts/localize-remote-media.js
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const GENERATED_DIR = path.join(ROOT, "data", "generated");

// 加载 .env(DATABASE_URL)
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function extOf(url, ct) {
  const m = String(url)
    .split("?")[0]
    .match(/\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i);
  if (m) return `.${m[1].toLowerCase().replace("jpeg", "jpg")}`;
  if (/png/.test(ct || "")) return ".png";
  if (/jpe?g/.test(ct || "")) return ".jpg";
  if (/mp4/.test(ct || "")) return ".mp4";
  return ".bin";
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const fname = `gen-${Date.now()}-${Math.round(Math.random() * 1e4)}${extOf(url, res.headers.get("content-type"))}`;
  fs.writeFileSync(path.join(GENERATED_DIR, fname), buf);
  return `generated/${fname}`;
}

async function main() {
  const assets = await prisma.asset.findMany({ where: { deletedAt: null } });
  let done = 0;
  let failed = 0;
  for (const a of assets) {
    const patch = {};
    for (const field of ["mediaUrl", "posterUrl"]) {
      const url = a[field];
      if (url && /^https?:/i.test(url)) {
        try {
          patch[field] = await download(url);
          console.log(`✓ ${a.kind} ${a.id} ${field} → ${patch[field]}`);
        } catch (e) {
          failed++;
          console.log(`✗ ${a.kind} ${a.id} ${field} 下载失败(可能已失效): ${e.message}`);
        }
      }
    }
    if (Object.keys(patch).length) {
      await prisma.asset.update({ where: { id: a.id }, data: patch });
      done++;
    }
  }
  console.log(`\n— 完成 — 更新 ${done} 个资产,失败 ${failed} 项`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
