const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const {
  hasRunningHubApi,
  pollRunningHubTask,
  resolveRunningHubMediaValue,
  runRunningHubAiApp,
  runningHubBaseUrl,
} = require("./runninghub-client");

const VIDEO_TYPES = ["商品展示视频", "图文混剪视频", "商品讲解视频"];

const RATIO_PRESETS = {
  "9:16 竖版": { aspectRatio: "9:16", width: 720, height: 1280 },
  "1:1 方版": { aspectRatio: "1:1", width: 960, height: 960 },
  "16:9 横版": { aspectRatio: "16:9", width: 1280, height: 720 },
};

const DURATION_MAP = {
  "15 秒": "5",
  "30 秒": "10",
};

function normalizeVideoType(value) {
  const text = String(value || "").trim();
  return VIDEO_TYPES.includes(text) ? text : "商品展示视频";
}

function resolveRatioPreset(value) {
  return RATIO_PRESETS[String(value || "").trim()] || RATIO_PRESETS["9:16 竖版"];
}

function resolveDuration(value) {
  return DURATION_MAP[String(value || "").trim()] || "5";
}

function ensureGeneratedDir(rootDir) {
  const dir = path.join(rootDir, "data", "generated");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function escapeXml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildVideoScript(product, options) {
  const script = String(options.script || options.extraPrompt || "").trim();
  if (script) return script;
  const videoType = normalizeVideoType(options.videoType);
  const hook = (product.sellingPoints || "").split(/[、，,]/)[0] || product.name;
  return `[0-3s] 开场：${hook}，真的值得看看\n[3-12s] 展示：${product.name}，${product.sellingPoints}\n[12-15s] 转化：${product.specs}，适合${product.category}场景`;
}

function buildVideoPrompt(product, options) {
  const videoType = normalizeVideoType(options.videoType);
  const script = buildVideoScript(product, options);
  const style = String(options.extraPrompt || "").trim();
  return [
    `电商${videoType}，竖屏种草风格，真实商品展示。`,
    `商品：${product.name}`,
    `类目：${product.category}`,
    `卖点：${product.sellingPoints}`,
    `脚本：${script}`,
    style ? `额外要求：${style}` : "",
    "画面自然、镜头稳定、适合抖音小红书发布。",
  ]
    .filter(Boolean)
    .join("\n");
}

function defaultReferenceImageUrls(options, context = {}) {
  const selected = Array.isArray(options.referenceImageUrls) ? options.referenceImageUrls.filter(Boolean) : [];
  if (selected.length) return selected;
  return (context.productImages || []).map((item) => item.url).filter(Boolean);
}

function valueOrDefault(value, fallback) {
  const text = String(value ?? "").trim();
  return text ? text : fallback;
}

function overrideVideoDefaults(nodeInfoList, options = {}) {
  const overrides = {
    "131": valueOrDefault(options.frameRate, ""),
    "165": valueOrDefault(options.seconds, ""),
    "112": valueOrDefault(options.videoWidth, ""),
    "164": valueOrDefault(options.videoHeight, ""),
    "115": valueOrDefault(options.mode, ""),
    "116": valueOrDefault(options.expressionIntensity, ""),
    "132": valueOrDefault(options.ruKilnAmplitude, ""),
  };
  return nodeInfoList.map((node) => ({
    ...node,
    fieldValue: overrides[node.nodeId] || node.fieldValue,
  }));
}

async function buildAiAppVideoNodeInfo(product, options, context = {}) {
  const config = options.runningHub || {};
  const refs = defaultReferenceImageUrls(options, context);
  const referenceVideo = String(
    options.referenceVideoUrl || config.defaultReferenceVideo || process.env.RUNNINGHUB_VIDEO_REFERENCE_VIDEO || ""
  ).trim();

  const nodeInfoList = overrideVideoDefaults(
    (config.nodeInfoDefaults || []).map((node) => ({
      nodeId: String(node.nodeId),
      fieldName: node.fieldName || "value",
      fieldValue: String(node.fieldValue ?? ""),
      description: node.description || node.fieldName || "value",
    })),
    options
  );

  for (const node of config.mediaNodes || []) {
    let source = "";
    if (node.source === "referenceVideo") {
      source = referenceVideo;
    } else {
      const index = Number.isFinite(Number(node.index)) ? Number(node.index) : 0;
      source = refs[index] || refs[0] || "";
    }
    if (!source && node.required) {
      const label = node.source === "referenceVideo" ? "参考视频" : "参考图片";
      throw new Error(`缺少 RunningHub 视频${label}：请补充后再生成。`);
    }
    if (!source) continue;
    nodeInfoList.push({
      nodeId: String(node.nodeId),
      fieldName: node.fieldName || (node.source === "referenceVideo" ? "video" : "image"),
      fieldValue: await resolveRunningHubMediaValue(source, context),
      description: node.description || node.fieldName || "media",
    });
  }

  return nodeInfoList;
}

function createTemplatePosterSvg(product, options) {
  const ratio = resolveRatioPreset(options.videoRatio);
  const width = ratio.width;
  const height = ratio.height;
  const c1 = product.colors?.[0] || "#1e293b";
  const c2 = product.colors?.[1] || "#2563eb";
  const title = escapeXml(product.name);
  const subtitle = escapeXml(normalizeVideoType(options.videoType));
  const duration = escapeXml(String(options.videoDuration || "15 秒"));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="100%" stop-color="${c2}" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <circle cx="${width / 2}" cy="${height / 2}" r="72" fill="rgba(255,255,255,0.18)" />
  <polygon points="${width / 2 - 24},${height / 2 - 32} ${width / 2 - 24},${height / 2 + 32} ${width / 2 + 34},${height / 2}" fill="#ffffff" />
  <text x="48" y="72" font-size="34" font-family="Arial, sans-serif" fill="#ffffff" font-weight="700">${title}</text>
  <text x="48" y="118" font-size="22" font-family="Arial, sans-serif" fill="#e2e8f0">${subtitle} · ${duration}</text>
  <text x="48" y="${height - 48}" font-size="18" font-family="Arial, sans-serif" fill="#cbd5e1">模板预览 · 配置 RUNNINGHUB_API_KEY 生成真实视频</text>
</svg>`;
}

function generateTemplateVideo(product, options, context = {}) {
  const rootDir = context.rootDir || path.join(__dirname, "..");
  const generatedDir = ensureGeneratedDir(rootDir);
  const slug = String(context.taskId || Date.now()).replace(/[^\w-]/g, "");
  const posterName = `${slug}-poster.svg`;
  const posterPath = path.join(generatedDir, posterName);
  const script = buildVideoScript(product, options);
  const ratio = resolveRatioPreset(options.videoRatio);

  fs.writeFileSync(posterPath, createTemplatePosterSvg(product, options), "utf8");

  return {
    provider: "template",
    videoType: normalizeVideoType(options.videoType),
    aspectRatio: ratio.aspectRatio,
    duration: String(options.videoDuration || "15 秒"),
    script,
    posterUrl: `/generated/${posterName}`,
    videoUrl: "",
  };
}

function resolveRunningHubVideoEndpoint(workflowId) {
  const id = String(workflowId || "").trim();
  if (id.startsWith("/openapi/")) return id;
  if (id) return `/openapi/v2/${id}/text-to-video`;
  return process.env.RUNNINGHUB_VIDEO_ENDPOINT || "/openapi/v2/kling-v2.5-turbo-std/text-to-video";
}

async function downloadAndExtractZip(zipUrl, context) {
  const resp = await fetch(zipUrl);
  if (!resp.ok) throw new Error(`下载 zip 失败: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const videoEntry = entries.find((e) => !e.isDirectory && (e.name.endsWith(".mp4") || e.name.endsWith(".mov") || e.name.endsWith(".webm")));
  if (!videoEntry) throw new Error("zip 中未找到视频文件");
  const rootDir = context.rootDir || path.join(__dirname, "..");
  const generatedDir = ensureGeneratedDir(rootDir);
  const slug = String(context.taskId || Date.now()).replace(/[^\w-]/g, "");
  const outName = `${slug}-${videoEntry.name}`;
  const outPath = path.join(generatedDir, outName);
  fs.writeFileSync(outPath, videoEntry.getData());
  return outName;
}

async function generateRunningHubAiAppVideo(product, options, context = {}) {
  const config = options.runningHub || {};
  const ratio = resolveRatioPreset(options.videoRatio);
  const nodeInfoList = await buildAiAppVideoNodeInfo(product, options, context);
  const { results } = await runRunningHubAiApp(config.appId || options.runningHubAppId, nodeInfoList, {
    localTaskId: context.taskId || "",
    label: "视频生成",
  });
  let videoResult = results.find((item) => String(item.outputType || "").toLowerCase().includes("mp4"));
  if (!videoResult) {
    const zipResult = results.find((item) => String(item.outputType || "").toLowerCase().includes("zip"));
    if (zipResult?.url) {
      const mp4Name = await downloadAndExtractZip(zipResult.url, context);
      videoResult = { url: `/generated/${mp4Name}`, nodeId: zipResult.nodeId, outputType: "mp4" };
    } else {
      videoResult = results[0];
    }
  }
  if (!videoResult?.url) {
    throw new Error("RunningHub 未返回视频结果");
  }
  return {
    provider: "runninghub",
    videoType: normalizeVideoType(options.videoType),
    aspectRatio: ratio.aspectRatio,
    duration: String(options.videoDuration || "15 秒"),
    script: buildVideoScript(product, options),
    posterUrl: "",
    videoUrl: videoResult.url,
    runningHubAppId: config.appId || options.runningHubAppId,
    nodeId: videoResult.nodeId,
    outputType: videoResult.outputType,
  };
}

async function generateRunningHubVideo(product, options, context = {}) {
  if (options.runningHub?.type === "ai-app" || options.runningHubAppId) {
    return generateRunningHubAiAppVideo(product, options, context);
  }

  const ratio = resolveRatioPreset(options.videoRatio);
  const duration = resolveDuration(options.videoDuration);
  const prompt = buildVideoPrompt(product, options);
  const endpoint = resolveRunningHubVideoEndpoint(options.runningHubWorkflowId);
  const referenceImages = Array.isArray(options.referenceImageUrls) ? options.referenceImageUrls : [];

  const body = {
    prompt,
    duration,
    guidanceScale: 0.5,
    aspectRatio: ratio.aspectRatio,
  };
  if (referenceImages.length > 0) {
    body.referenceImageUrls = referenceImages;
    body.referenceStrength = Number(options.referenceStrength) || 0.5;
  }

  const response = await fetch(`${runningHubBaseUrl()}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RUNNINGHUB_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`RunningHub video submit error: ${response.status} ${detail.slice(0, 120)}`);
  }

  const payload = await response.json();
  if (payload.status === "FAILED") {
    throw new Error(payload.errorMessage || "RunningHub 视频任务提交失败");
  }

  let results = Array.isArray(payload.results) ? payload.results.filter((item) => item?.url) : [];
  if (!results.length && payload.taskId) {
    results = await pollRunningHubTask(payload.taskId, "视频生成");
  }
  if (!results.length) {
    throw new Error("RunningHub 未返回视频结果");
  }

  const videoUrl = results[0].url;
  return {
    provider: "runninghub",
    videoType: normalizeVideoType(options.videoType),
    aspectRatio: ratio.aspectRatio,
    duration: String(options.videoDuration || "15 秒"),
    script: buildVideoScript(product, options),
    posterUrl: "",
    videoUrl,
  };
}

async function generateVideo(product, options = {}, context = {}) {
  if (hasRunningHubApi()) {
    return generateRunningHubVideo(product, options, context);
  }
  return generateTemplateVideo(product, options, context);
}

module.exports = {
  VIDEO_TYPES,
  RATIO_PRESETS,
  generateVideo,
  hasRunningHubApi,
  normalizeVideoType,
  resolveRatioPreset,
  resolveDuration,
  buildVideoScript,
  buildVideoPrompt,
};
