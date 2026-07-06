// 发布载荷组装:把一个商品「审核通过后的成品」整理成可发布/可导出的包。
// 来源:最新视频资产=视频;最新「发布文案」=标题+正文;主图/视频封面=封面;标签从文案#话题或类目/卖点派生。
// 手动导出(给网页版发)和 social-auto-upload 自动发,都用这一份。
const path = require("node:path");
const assetRepo = require("../repositories/asset.repo");

const ROOT = path.join(__dirname, "..", "..");

// 本地素材相对路径(uploads/x、generated/x)→ 绝对路径;已是绝对/远程则原样。
function toAbs(mediaUrl) {
  const u = String(mediaUrl || "").trim();
  if (!u) return "";
  if (path.isAbsolute(u) || /^https?:/i.test(u)) return u;
  return path.join(ROOT, "data", u.replace(/^\//, ""));
}

// 从文案里抽 #话题;不足则用类目/卖点补,去重、最多 6 个、去掉 # 前缀返回纯词。
function deriveTags(copyText, product) {
  const tags = [];
  for (const m of String(copyText || "").matchAll(/#([^#\s，,。!！?？]+)/g)) {
    if (m[1]) tags.push(m[1].trim());
  }
  if (product.category) tags.push(String(product.category).trim());
  for (const p of String(product.sellingPoints || "").split(/[、，,]/)) {
    const t = p.trim();
    if (t && t.length <= 8) tags.push(t);
  }
  return [...new Set(tags.filter(Boolean))].slice(0, 6);
}

// 标题:文案首行(截 30 字);正文:整段文案;都没有则用商品名/卖点兜底。
function splitTitleDesc(copyText, product) {
  const text = String(copyText || "").trim();
  if (!text) {
    return { title: product.name || "", desc: product.sellingPoints || product.name || "" };
  }
  const firstLine = text.split(/\n/)[0].trim();
  const title = (firstLine || product.name || "")
    .replace(/#[^#\s]+/g, "")
    .trim()
    .slice(0, 30);
  return { title: title || product.name || "", desc: text };
}

// 组装发布载荷。opts.requireVideo=true 时无视频报错(默认 true)。
async function buildPublishPayload(product, opts = {}) {
  const requireVideo = opts.requireVideo !== false;
  const videos = await assetRepo.listByProduct(product.id, "video");
  const video = videos[videos.length - 1] || null;
  if (requireVideo && !video?.mediaUrl) {
    return { ok: false, error: "没有可发布的视频:请先生成视频" };
  }

  const copies = await assetRepo.listByProduct(product.id, "copy");
  const publishCopy =
    copies.filter((c) => c.type === "发布文案").pop() || copies[copies.length - 1] || null;
  const copyText = publishCopy?.content || "";

  const images = await assetRepo.listByProduct(product.id, "image");
  const cover = images.find((i) => i.isPrimary) || images[images.length - 1] || null;
  const coverSrc = cover?.mediaUrl || video?.posterUrl || "";

  const { title, desc } = splitTitleDesc(copyText, product);

  return {
    ok: true,
    productId: product.id,
    productName: product.name || "",
    videoUrl: video?.mediaUrl || "", // 系统内可访问(/generated 或 /uploads)
    videoPath: toAbs(video?.mediaUrl), // 绝对路径,给 social-auto-upload
    coverUrl: coverSrc,
    coverPath: toAbs(coverSrc),
    title,
    desc,
    tags: deriveTags(copyText, product),
    copyAssetId: publishCopy?.id || null,
    videoAssetId: video?.id || null,
  };
}

module.exports = { buildPublishPayload, deriveTags, splitTitleDesc, toAbs };
