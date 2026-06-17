// 节点执行器:把 generate 节点接到真实生成适配器,产物存成 Asset。
// 文案→DeepSeek;图片→RunningHub 生图(以商品原图为参考);视频→RunningHub 生视频。
// 无对应密钥时各适配器自动走模板兜底(产物写入 data/generated)。
const path = require("node:path");
const copyAdapter = require("../copy-adapter");
const imageAdapter = require("../image-adapter");
const videoAdapter = require("../video-adapter");
const assetRepo = require("../repositories/asset.repo");
const modelImageRepo = require("../repositories/model-image.repo");
const refVideoRepo = require("../repositories/reference-video.repo");
const { defaultGenerationParams } = require("../workflow-params");
const { mergeGenerationParams, pickTemplateForNode } = require("../generation-template-service");

// 本地素材 url("uploads/x"/"generated/x")→ 绝对路径;远程 http 原样返回(供 RunningHub 取/上传)。
function toRef(mediaUrl) {
  if (!mediaUrl) return "";
  return /^https?:/i.test(mediaUrl) ? mediaUrl : path.join(ROOT, "data", mediaUrl);
}

const ROOT = path.join(__dirname, "..", "..");

function safeParse(s, fallback) {
  if (!s) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

// 新库商品 → 旧适配器期望的形状(priceCents→元、platforms JSON→数组)。
function adaptProduct(p) {
  const platforms = safeParse(p.platforms, []);
  return {
    id: p.id,
    name: p.name || "",
    category: p.category || "",
    price: (p.priceCents ?? 0) / 100,
    sellingPoints: p.sellingPoints || "",
    specs: p.specs || "",
    colors: safeParse(p.colors, []),
    platforms,
  };
}

// 商品原图(kind=original)→ 绝对文件路径(runninghub-client 据此上传到 RunningHub)。
async function originalAbsPaths(productId) {
  const originals = await assetRepo.listByProduct(productId, "original");
  return originals
    .map((a) => a.mediaUrl) // "uploads/xxx.png"
    .filter(Boolean)
    .map((u) => path.join(ROOT, "data", u)); // ROOT/data/uploads/xxx.png
}

// 产物 url → asset.mediaUrl:远程 http 原样存;本地 "/generated/x" 去掉前导斜杠存 "generated/x"。
function toStoredUrl(url) {
  if (!url) return null;
  return /^https?:/i.test(url) ? url : url.replace(/^\//, "");
}

async function runCopy(node, product, params, opts = {}) {
  const adapted = adaptProduct(product);
  const result = await copyAdapter.generateCopy(adapted, {
    copyType: params.copyType || "发布文案",
    platform: adapted.platforms[0] || "抖音",
    versionCount: Number(opts.versionCount) > 0 ? Number(opts.versionCount) : 3,
    extraPrompt: opts.prompt || undefined,
  });
  const assetIds = [];
  for (let i = 0; i < result.versions.length; i++) {
    const asset = await assetRepo.create({
      productId: product.id,
      kind: "copy",
      type: result.copyType,
      name: `${result.copyType} ${i + 1}`,
      status: "已生成",
      usage: "成品库",
      provider: result.provider,
      content: result.versions[i],
    });
    assetIds.push(asset.id);
  }
  return {
    ok: true,
    assetIds,
    summary: `${result.provider} 生成 ${result.versions.length} 条「${result.copyType}」`,
  };
}

async function runImage(node, product, params, opts = {}) {
  const adapted = adaptProduct(product);
  const platform = adapted.platforms[0] || "抖音";
  const clothing = await originalAbsPaths(product.id); // 服装图 → node79

  // 模特图 → node41(换装工作流必填):生成时选的 modelImageId
  let modelRefs = [];
  if (opts.modelImageId) {
    const m = await modelImageRepo.getById(opts.modelImageId);
    if (m && !m.deletedAt && m.mediaUrl) modelRefs = [toRef(m.mediaUrl)];
  }
  if (imageAdapter.hasRunningHubApi() && !modelRefs.length) {
    throw new Error("换装生图需要先选模特图:到「模特图库」上传后,执行图片节点时选择一张");
  }

  const template = pickTemplateForNode({ kind: "image", params }, platform);
  const options = mergeGenerationParams(template, {
    ...defaultGenerationParams("image", adapted),
    ...params,
    platform,
    referenceImageUrls: clothing, // node79 服装
    modelImageUrls: modelRefs, // node41 模特
    ...(opts.prompt ? { extraPrompt: opts.prompt } : {}), // 用户改了提示词则覆盖换装默认词
  });
  const context = {
    rootDir: ROOT,
    taskId: `${product.id}-img-${Date.now()}`,
    productImages: clothing.map((url) => ({ url })),
  };
  const result = await imageAdapter.generateImages(adapted, options, context);
  const assetIds = [];
  for (let i = 0; i < result.images.length; i++) {
    const asset = await assetRepo.create({
      productId: product.id,
      kind: "image",
      type: result.imageType,
      name: `${result.imageType} ${i + 1}`,
      status: "已生成",
      usage: "成品库",
      provider: result.provider,
      isPrimary: i === 0,
      mediaUrl: toStoredUrl(result.images[i].url),
      aspectRatio: result.aspectRatio,
    });
    assetIds.push(asset.id);
  }
  return {
    ok: true,
    assetIds,
    summary: `${result.provider} 生成 ${result.images.length} 张「${result.imageType}」`,
  };
}

// 最新生成的换装图(kind=image)的可用引用,作视频 node103 参考图片。
async function latestGeneratedImageRef(productId) {
  const imgs = await assetRepo.listByProduct(productId, "image"); // createdAt 升序
  const latest = imgs[imgs.length - 1];
  return latest ? toRef(latest.mediaUrl) : "";
}

const VIDEO_PARAM_KEYS = [
  "frameRate",
  "seconds",
  "videoWidth",
  "videoHeight",
  "mode",
  "expressionIntensity",
  "ruKilnAmplitude",
];

async function runVideo(node, product, params, opts = {}) {
  const adapted = adaptProduct(product);
  const platform = adapted.platforms[0] || "抖音";
  const imgRef = await latestGeneratedImageRef(product.id); // node103 参考图片=最新换装图
  if (videoAdapter.hasRunningHubApi() && !imgRef) {
    throw new Error("生视频需要先生成换装图:视频以最新的换装图作为参考");
  }

  // node161 参考视频:生成时选的 referenceVideoId(覆盖 env 默认)
  let refVideoPath = "";
  if (opts.referenceVideoId) {
    const rv = await refVideoRepo.getById(opts.referenceVideoId);
    if (rv && !rv.deletedAt && rv.mediaUrl) refVideoPath = toRef(rv.mediaUrl);
  }
  // 用户微调的视频参数(帧率/秒数/宽/高/模式/表情/汝窑),只覆盖填了的
  const overrides = {};
  for (const k of VIDEO_PARAM_KEYS) {
    if (opts[k] !== undefined && opts[k] !== null && opts[k] !== "") overrides[k] = String(opts[k]);
  }

  const template = pickTemplateForNode({ kind: "video", params }, platform);
  const options = mergeGenerationParams(template, {
    ...defaultGenerationParams("video", adapted),
    ...params,
    platform,
    referenceImageUrls: imgRef ? [imgRef] : [], // node103
    ...(refVideoPath ? { referenceVideoUrl: refVideoPath } : {}), // node161
    ...overrides,
  });
  const context = {
    rootDir: ROOT,
    taskId: `${product.id}-vid-${Date.now()}`,
    productImages: imgRef ? [{ url: imgRef }] : [],
  };
  const result = await videoAdapter.generateVideo(adapted, options, context);
  const asset = await assetRepo.create({
    productId: product.id,
    kind: "video",
    type: result.videoType,
    name: result.videoType,
    status: "已生成",
    usage: "成品库",
    provider: result.provider,
    mediaUrl: toStoredUrl(result.videoUrl),
    posterUrl: toStoredUrl(result.posterUrl),
    content: result.script || null,
    aspectRatio: result.aspectRatio,
    duration: result.duration,
  });
  return {
    ok: true,
    assetIds: [asset.id],
    summary: `${result.provider} 生成「${result.videoType}」`,
  };
}

// 执行一个 generate 节点。返回 { ok, assetIds?, summary } 或 { ok:false, error }。
async function executeGenerateNode(node, product, opts = {}) {
  if (!product) return { ok: false, error: "商品不存在" };
  const meta = safeParse(node.meta, {});
  const params = meta.params || {};

  if (node.kind === "copy") return runCopy(node, product, params, opts);
  if (node.kind === "image") return runImage(node, product, params, opts);
  if (node.kind === "video") return runVideo(node, product, params, opts);

  // listing / publish 等非生成副作用节点:平台 API 对接前暂演示成功。
  return { ok: true, demo: true, summary: "演示执行(上架/发布待接平台 API)" };
}

module.exports = { executeGenerateNode };
