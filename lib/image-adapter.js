const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const {
  hasRunningHubApi,
  pollRunningHubTask,
  resolveRunningHubMediaValue,
  runRunningHubAiApp,
} = require("./runninghub-client");

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
  const extra = String(options.extraPrompt || "").trim();
  if (extra) return extra;
  return `生成商品展示图，主体为「${product?.name || "商品"}」，要求：商品清晰居中、背景简洁、光线均匀、细节完整`;
}

function defaultReferenceImageUrls(options, context = {}) {
  const selected = Array.isArray(options.referenceImageUrls)
    ? options.referenceImageUrls.filter(Boolean)
    : [];
  if (selected.length) return selected;
  return (context.productImages || []).map((item) => item.url).filter(Boolean);
}

function valueOrDefault(value, fallback) {
  const text = String(value ?? "").trim();
  return text ? text : fallback;
}

// 把换装图的档位参数覆盖到工作流节点(app 2034233561917689858):
// 姿势→105、胸部→120、腰臀比→114、输出方式→131(1=直出 / 2=ZIP,ZIP 绕过内容安审)。
// 未传的档位保留工作流默认值。
function overrideImageDefaults(nodeInfoList, options = {}) {
  const overrides = {
    105: valueOrDefault(options.poseMode, ""), // 姿势
    120: valueOrDefault(options.chestMode, ""), // 胸部
    114: valueOrDefault(options.waistHipMode, ""), // 腰臀比
    131: valueOrDefault(options.outputMode, ""), // 输出方式
  };
  return nodeInfoList.map((node) => ({
    ...node,
    fieldValue: overrides[node.nodeId] || node.fieldValue,
  }));
}

async function buildAiAppImageNodeInfo(product, options, context = {}) {
  const config = options.runningHub || {};
  const refs = defaultReferenceImageUrls(options, context);
  const modelRefs = (Array.isArray(options.modelImageUrls) ? options.modelImageUrls : []).filter(
    Boolean
  );
  const slot3Refs = (Array.isArray(options.slot3Urls) ? options.slot3Urls : []).filter(Boolean);
  if (!refs.length) {
    throw new Error("缺少商品原图：请先在商品资料节点上传至少 1 张原图。");
  }

  function pickSource(node) {
    if (node.source === "slot3" && slot3Refs.length) return slot3Refs[0];
    const pool = node.source === "modelImage" ? modelRefs : refs;
    const index = Number.isFinite(Number(node.index)) ? Number(node.index) : 0;
    return pool[index] || (config.allowReuseFirstReference ? pool[0] || refs[0] : "");
  }

  const nodeInfoList = [];
  const mediaNodes = Array.isArray(config.mediaNodes) ? config.mediaNodes : [];
  for (const node of mediaNodes) {
    const source = pickSource(node);
    if (!source && node.required) {
      const label = node.description || node.fieldName || `节点 ${node.nodeId}`;
      throw new Error(`缺少 ${label}：请选择${node.source === "modelImage" ? "模特" : "商品"}图。`);
    }
    if (!source) continue;
    nodeInfoList.push({
      nodeId: String(node.nodeId),
      fieldName: node.fieldName || "image",
      fieldValue: await resolveRunningHubMediaValue(source, context),
      description: node.description || node.fieldName || "image",
    });
  }

  if (config.promptNode) {
    nodeInfoList.push({
      nodeId: String(config.promptNode.nodeId),
      fieldName: config.promptNode.fieldName || "prompt",
      fieldValue: buildImagePrompt(product, options),
      description: config.promptNode.description || "prompt",
    });
  }

  // 档位默认(105/120/114/131)+ 用户所选档位覆盖
  const defaults = (config.nodeInfoDefaults || []).map((node) => ({
    nodeId: String(node.nodeId),
    fieldName: node.fieldName || "value",
    fieldValue: String(node.fieldValue ?? ""),
    description: node.description || node.fieldName || "value",
  }));
  for (const node of overrideImageDefaults(defaults, options)) {
    nodeInfoList.push(node);
  }

  return nodeInfoList;
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

function resolveRunningHubImagePath(workflowId) {
  const id = String(workflowId || "seedream-v5-lite").trim();
  if (id.includes("/")) return id.replace(/^\//, "");
  return `openapi/v2/${id}/text-to-image`;
}

// 输出方式=ZIP(节点131=2,绕内容安审)时,结果是 zip;下载解包取出其中所有图片,落本地。
async function extractImagesFromZip(zipUrl, context = {}) {
  const resp = await fetch(zipUrl);
  if (!resp.ok) throw new Error(`下载图片 zip 失败: ${resp.status}`);
  const zip = new AdmZip(Buffer.from(await resp.arrayBuffer()));
  const rootDir = context.rootDir || path.join(__dirname, "..");
  const generatedDir = ensureGeneratedDir(rootDir);
  const slug = String(context.taskId || Date.now()).replace(/[^\w-]/g, "");
  const out = [];
  const entries = zip
    .getEntries()
    .filter((e) => !e.isDirectory && /\.(png|jpe?g|webp)$/i.test(e.name));
  entries.forEach((entry, i) => {
    const outName = `${slug}-zip-${i + 1}-${entry.name.replace(/[^\w.-]/g, "")}`;
    fs.writeFileSync(path.join(generatedDir, outName), entry.getData());
    out.push({ url: `/generated/${outName}` });
  });
  if (!out.length) throw new Error("图片 zip 中未找到图片文件");
  return out;
}

async function generateRunningHubAiAppImages(product, options, context = {}) {
  const config = options.runningHub || {};
  const imageType = normalizeImageType(options.imageType);
  const aspect = resolveAspectPreset(options.imageSize);
  const count = clampImageCount(options.imageCount);
  const nodeInfoList = await buildAiAppImageNodeInfo(product, options, context);
  const { results } = await runRunningHubAiApp(
    config.appId || options.runningHubAppId,
    nodeInfoList,
    {
      localTaskId: context.taskId || "",
      label: "图片生成",
      onStage: context.onStage, // 排队中/生成中 状态回调
    }
  );

  if (!results.length) {
    throw new Error("RunningHub 未返回图片结果");
  }

  // ZIP 输出:解包成多张本地图片;否则直接用返回的图片 URL。
  const zipResult = results.find((item) =>
    String(item.outputType || item.url || "")
      .toLowerCase()
      .includes("zip")
  );
  const imageResults = zipResult?.url
    ? await extractImagesFromZip(zipResult.url, context)
    : results;

  return {
    provider: "runninghub",
    imageType,
    aspectRatio: aspect.label,
    runningHubAppId: config.appId || options.runningHubAppId,
    images: imageResults.slice(0, count).map((item, index) => ({
      url: item.url,
      index,
      width: aspect.width,
      height: aspect.height,
      nodeId: item.nodeId,
      outputType: item.outputType,
    })),
  };
}

async function generateRunningHubImages(product, options, context = {}) {
  if (options.runningHub?.type === "ai-app" || options.runningHubAppId) {
    return generateRunningHubAiAppImages(product, options, context);
  }

  const imageType = normalizeImageType(options.imageType);
  const aspect = resolveAspectPreset(options.imageSize);
  const count = clampImageCount(options.imageCount);
  const prompt = buildImagePrompt(product, options);
  const baseUrl = String(process.env.RUNNINGHUB_BASE_URL || "https://www.runninghub.ai").replace(
    /\/$/,
    ""
  );
  const apiPath = resolveRunningHubImagePath(options.runningHubWorkflowId);
  const referenceImages = Array.isArray(options.referenceImageUrls)
    ? options.referenceImageUrls
    : [];

  const body = {
    prompt,
    width: aspect.width,
    height: aspect.height,
    resolution: "2k",
    sequentialImageGeneration: count > 1 ? "auto" : "disabled",
    maxImages: count,
  };
  if (referenceImages.length > 0) {
    body.referenceImageUrls = referenceImages;
    body.conditionImageType = "reference";
    body.referenceStrength = Number(options.referenceStrength) || 0.6;
  }

  const response = await fetch(`${baseUrl}/${apiPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RUNNINGHUB_API_KEY}`,
    },
    body: JSON.stringify(body),
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
    return generateRunningHubImages(product, options, context);
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
  buildAiAppImageNodeInfo, // 导出供测试:离线断言节点映射(公网URL不触发上传)
  overrideImageDefaults,
};
