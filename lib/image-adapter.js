const fs = require("fs");
const path = require("path");
const { hasRunningHubApi, pollRunningHubTask } = require("./runninghub-client");

const IMAGE_TYPES = ["商品主图", "详情页图", "卖点图", "封面图", "场景图"];

const ASPECT_PRESETS = {
  "1:1 平台主图": { width: 2048, height: 2048, label: "1:1" },
  "3:4 小红书": { width: 2048, height: 2732, label: "3:4" },
  "9:16 竖版": { width: 2048, height: 3640, label: "9:16" },
};

function normalizeImageType(value) {
  const text = String(value || "").trim();
  return IMAGE_TYPES.includes(text) ? text : "商品主图";
}

function clampImageCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 4;
  return Math.min(6, Math.max(1, Math.round(count)));
}

function resolveAspectPreset(value) {
  return ASPECT_PRESETS[String(value || "").trim()] || ASPECT_PRESETS["1:1 平台主图"];
}

function ensureGeneratedDir(rootDir) {
  const dir = path.join(rootDir, "data", "generated");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildImagePrompt(product, options) {
  const imageType = normalizeImageType(options.imageType);
  const style = String(options.extraPrompt || "").trim() || "真实商品质感，干净背景，突出核心卖点";
  return [
    `电商${imageType}，高质量产品摄影。`,
    `商品名称：${product.name}`,
    `类目：${product.category}`,
    `价格：${product.price} 元`,
    `核心卖点：${product.sellingPoints}`,
    `规格：${product.specs}`,
    `风格要求：${style}`,
    "适合中国电商平台，画面清晰，主体突出，无文字水印。",
  ].join("\n");
}

function escapeXml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createTemplateSvg(product, options, index, total) {
  const imageType = normalizeImageType(options.imageType);
  const aspect = resolveAspectPreset(options.imageSize);
  const width = 960;
  const height = aspect.label === "3:4" ? 1280 : aspect.label === "9:16" ? 1707 : 960;
  const c1 = product.colors?.[0] || "#bfdbfe";
  const c2 = product.colors?.[1] || "#5eead4";
  const title = escapeXml(product.name);
  const subtitle = escapeXml(`${imageType} · 版本 ${index + 1}/${total}`);
  const selling = escapeXml((product.sellingPoints || "").slice(0, 36));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="100%" stop-color="${c2}" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect x="48" y="48" width="${width - 96}" height="${height - 96}" rx="28" fill="rgba(255,255,255,0.82)" />
  <text x="96" y="160" font-size="42" font-family="Arial, sans-serif" fill="#0f172a" font-weight="700">${title}</text>
  <text x="96" y="220" font-size="24" font-family="Arial, sans-serif" fill="#475569">${subtitle}</text>
  <text x="96" y="280" font-size="22" font-family="Arial, sans-serif" fill="#334155">${selling}</text>
  <text x="96" y="${height - 96}" font-size="18" font-family="Arial, sans-serif" fill="#64748b">模板预览 · 配置 RUNNINGHUB_API_KEY 可切换真实生成</text>
</svg>`;
}

function generateTemplateImages(product, options, context = {}) {
  const rootDir = context.rootDir || path.join(__dirname, "..");
  const generatedDir = ensureGeneratedDir(rootDir);
  const imageType = normalizeImageType(options.imageType);
  const aspect = resolveAspectPreset(options.imageSize);
  const count = clampImageCount(options.imageCount);
  const slug = String(context.taskId || Date.now()).replace(/[^\w-]/g, "");

  const images = Array.from({ length: count }, (_, index) => {
    const fileName = `${slug}-${index + 1}.svg`;
    const filePath = path.join(generatedDir, fileName);
    fs.writeFileSync(filePath, createTemplateSvg(product, options, index, count), "utf8");
    return {
      url: `/generated/${fileName}`,
      index,
      width: aspect.width,
      height: aspect.height,
    };
  });

  return {
    provider: "template",
    imageType,
    aspectRatio: aspect.label,
    images,
  };
}

async function generateRunningHubImages(product, options) {
  const imageType = normalizeImageType(options.imageType);
  const aspect = resolveAspectPreset(options.imageSize);
  const count = clampImageCount(options.imageCount);
  const prompt = buildImagePrompt(product, options);
  const baseUrl = String(process.env.RUNNINGHUB_BASE_URL || "https://www.runninghub.ai").replace(/\/$/, "");

  const response = await fetch(`${baseUrl}/openapi/v2/seedream-v5-lite/text-to-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RUNNINGHUB_API_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      width: aspect.width,
      height: aspect.height,
      resolution: "2k",
      sequentialImageGeneration: count > 1 ? "auto" : "disabled",
      maxImages: count,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`RunningHub submit error: ${response.status} ${detail.slice(0, 120)}`);
  }

  const payload = await response.json();
  if (payload.status === "FAILED") {
    throw new Error(payload.errorMessage || "RunningHub 提交任务失败");
  }

  let results = Array.isArray(payload.results) ? payload.results.filter((item) => item?.url) : [];
  if (!results.length && payload.taskId) {
    results = await pollRunningHubTask(payload.taskId, "图片生成");
  }
  if (!results.length) {
    throw new Error("RunningHub 未返回图片结果");
  }

  return {
    provider: "runninghub",
    imageType,
    aspectRatio: aspect.label,
    images: results.slice(0, count).map((item, index) => ({
      url: item.url,
      index,
      width: aspect.width,
      height: aspect.height,
    })),
  };
}

async function generateImages(product, options = {}, context = {}) {
  if (hasRunningHubApi()) {
    return generateRunningHubImages(product, options);
  }
  return generateTemplateImages(product, options, context);
}

module.exports = {
  IMAGE_TYPES,
  ASPECT_PRESETS,
  generateImages,
  hasRunningHubApi,
  normalizeImageType,
  clampImageCount,
  resolveAspectPreset,
  buildImagePrompt,
};
