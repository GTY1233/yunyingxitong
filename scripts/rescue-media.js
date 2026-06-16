// 媒体抢救脚本（非破坏性）：把资产里「远程 RunningHub COS 链接的真实图/视频」下载到本地
// media-backup/，并把本地已有的真实视频一并归集，输出 manifest.json 便于后续重新关联。
// 不修改 data/db.json。用法：node scripts/rescue-media.js
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "db.json");
const GENERATED = path.join(ROOT, "data", "generated");
const OUT = path.join(ROOT, "media-backup");
const OUT_IMG = path.join(OUT, "images");
const OUT_VID = path.join(OUT, "videos");

for (const dir of [OUT, OUT_IMG, OUT_VID]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function extFromContentType(ct, url) {
  if (/png/.test(ct)) return ".png";
  if (/jpe?g/.test(ct)) return ".jpg";
  if (/webp/.test(ct)) return ".webp";
  if (/mp4/.test(ct)) return ".mp4";
  const m = String(url).match(/\.(png|jpe?g|webp|mp4|mov)(\?|$)/i);
  return m ? "." + m[1].toLowerCase() : ".bin";
}

function download(url, destNoExt, redirects = 0) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 4) {
        res.resume();
        return resolve(download(res.headers.location, destNoExt, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ ok: false, reason: `HTTP ${res.statusCode}` });
      }
      const ext = extFromContentType(res.headers["content-type"] || "", url);
      const dest = destNoExt + ext;
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve({ ok: true, file: dest, bytes: Number(res.headers["content-length"] || 0) })));
      file.on("error", (e) => resolve({ ok: false, reason: e.message }));
    });
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, reason: "timeout" }); });
    req.on("error", (e) => resolve({ ok: false, reason: e.message }));
  });
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  const assets = db.assets || [];
  const manifest = [];
  let savedImg = 0, savedVid = 0, deadImg = 0, copiedLocal = 0;

  for (const a of assets) {
    if (a.kind === "image" && /^https?:/.test(a.imageUrl || "")) {
      const r = await download(a.imageUrl, path.join(OUT_IMG, `${a.id}_${a.productId || "NA"}`));
      if (r.ok) { savedImg++; console.log(`✓ 图 ${a.id} -> ${path.basename(r.file)} (${(r.bytes / 1024 | 0)}KB)`); }
      else { deadImg++; console.log(`✗ 图 ${a.id} 失败: ${r.reason}`); }
      manifest.push({ assetId: a.id, productId: a.productId, kind: "image", name: a.name, originalUrl: a.imageUrl, localFile: r.ok ? path.relative(ROOT, r.file) : null, status: r.ok ? "saved" : "lost:" + r.reason });
    } else if (a.kind === "video") {
      const v = a.videoUrl || "";
      if (/^https?:/.test(v)) {
        const r = await download(v, path.join(OUT_VID, `${a.id}_${a.productId || "NA"}`));
        if (r.ok) { savedVid++; console.log(`✓ 视频 ${a.id} -> ${path.basename(r.file)}`); }
        else { console.log(`✗ 视频 ${a.id} 失败: ${r.reason}`); }
        manifest.push({ assetId: a.id, productId: a.productId, kind: "video", name: a.name, originalUrl: v, localFile: r.ok ? path.relative(ROOT, r.file) : null, status: r.ok ? "saved" : "lost:" + r.reason });
      } else if (v.startsWith("/generated/")) {
        const src = path.join(GENERATED, v.replace("/generated/", ""));
        if (fs.existsSync(src) && !src.endsWith(".svg")) {
          const dest = path.join(OUT_VID, `${a.id}_${a.productId || "NA"}_${path.basename(src)}`);
          fs.copyFileSync(src, dest);
          copiedLocal++; console.log(`✓ 本地视频 ${a.id} 已归集 -> ${path.basename(dest)}`);
          manifest.push({ assetId: a.id, productId: a.productId, kind: "video", name: a.name, originalUrl: v, localFile: path.relative(ROOT, dest), status: "copied-local" });
        }
      }
    }
  }

  // 根目录的原始 mp4（来源未知，一并保全）
  for (const f of fs.readdirSync(ROOT)) {
    if (f.endsWith(".mp4")) {
      const dest = path.join(OUT_VID, "root_" + f);
      fs.copyFileSync(path.join(ROOT, f), dest);
      console.log(`✓ 根目录原始视频已备份 -> ${path.basename(dest)}`);
    }
  }

  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\n— 抢救完成 —`);
  console.log(`图片: 成功 ${savedImg} / 失效 ${deadImg}`);
  console.log(`视频: 远程下载 ${savedVid} / 本地归集 ${copiedLocal}`);
  console.log(`清单: media-backup/manifest.json（含每个资产的原链接→本地文件映射）`);
}

main();
