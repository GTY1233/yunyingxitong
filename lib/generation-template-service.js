const { defaultGenerationParams } = require("./workflow-params");

// 换装生图工作流(RunningHub AI-app 2034233561917689858)。
// 节点:22=人物(模特图)/23=服装(商品图)image;102=提示词 text;105姿势/120胸部/114腰臀比/131输出方式 select。
function imageRunningHubConfig() {
  return {
    type: "ai-app",
    appId: process.env.RUNNINGHUB_IMAGE_APP_ID || "2034233561917689858",
    mediaNodes: [
      {
        nodeId: "22",
        fieldName: "image",
        source: "modelImage",
        index: 0,
        description: "人物(模特图)",
        required: true,
      },
      {
        nodeId: "23",
        fieldName: "image",
        source: "referenceImage",
        index: 0,
        description: "服装(商品图)",
        required: true,
      },
    ],
    promptNode: { nodeId: "102", fieldName: "text", description: "提示词" },
    nodeInfoDefaults: [
      { nodeId: "105", fieldName: "select", fieldValue: "2", description: "姿势" },
      { nodeId: "120", fieldName: "select", fieldValue: "4", description: "胸部" },
      { nodeId: "114", fieldName: "select", fieldValue: "2", description: "腰臀比" },
      { nodeId: "131", fieldName: "select", fieldValue: "1", description: "输出方式" },
    ],
    allowReuseFirstReference: true,
  };
}

// 图生视频工作流(RunningHub AI-app 1975951975441412098)。
// 节点:299=参考图片 image / 275=参考视频 video;调参见 nodeInfoDefaults。
// 语义变化:比例改用「自定义比例宽/高」(451/450=9/16,需 452 开启),分辨率走预设 470;
// 时长由「加载帧上限」422 控(= 秒数 × 帧率,见 video-adapter.overrideVideoDefaults)。
function videoRunningHubConfig() {
  return {
    type: "ai-app",
    appId: process.env.RUNNINGHUB_VIDEO_APP_ID || "1975951975441412098",
    mediaNodes: [
      {
        nodeId: "299",
        fieldName: "image",
        source: "referenceImage",
        index: 0,
        description: "参考图片",
        required: true,
      },
      {
        nodeId: "275",
        fieldName: "video",
        source: "referenceVideo",
        description: "参考视频",
        required: true,
      },
    ],
    nodeInfoDefaults: [
      { nodeId: "535", fieldName: "select", fieldValue: "1", description: "zip不支持cn站" },
      { nodeId: "293", fieldName: "select", fieldValue: "1", description: "姿势计算方式" },
      { nodeId: "497", fieldName: "value", fieldValue: "false", description: "姿势3若脖子长开启" },
      {
        nodeId: "297",
        fieldName: "value",
        fieldValue: "1.0000000000000002",
        description: "姿势强度",
      },
      { nodeId: "370", fieldName: "value", fieldValue: "false", description: "运镜开关" },
      {
        nodeId: "361",
        fieldName: "value",
        fieldValue: "1.0000000000000002",
        description: "运镜强度",
      },
      { nodeId: "271", fieldName: "value", fieldValue: "false", description: "面具头盔模式" },
      {
        nodeId: "265",
        fieldName: "value",
        fieldValue: "0.8000000000000002",
        description: "表情强度",
      },
      {
        nodeId: "266",
        fieldName: "value",
        fieldValue: "0.20000000000000004",
        description: "胸部抖动幅度",
      },
      { nodeId: "499", fieldName: "value", fieldValue: "0", description: "跳过前面多少帧" },
      { nodeId: "422", fieldName: "value", fieldValue: "840", description: "加载帧上限" },
      { nodeId: "264", fieldName: "value", fieldValue: "30", description: "帧率" },
      { nodeId: "470", fieldName: "select", fieldValue: "2", description: "分辨率" },
      { nodeId: "452", fieldName: "value", fieldValue: "false", description: "开启自定义比例" },
      { nodeId: "451", fieldName: "value", fieldValue: "9", description: "自定义比例宽" },
      { nodeId: "450", fieldName: "value", fieldValue: "16", description: "自定义比例高" },
    ],
    defaultReferenceVideo: process.env.RUNNINGHUB_VIDEO_REFERENCE_VIDEO || "",
  };
}

const DEFAULT_GENERATION_TEMPLATES = [
  {
    id: "dy-image-main",
    platform: "抖音",
    kind: "image",
    name: "抖音主图 1:1",
    description: "四张主图，适合抖店商品卡与短视频封面。",
    runningHub: imageRunningHubConfig(),
    defaults: { imageType: "商品主图", imageSize: "1:1 平台主图", imageCount: 1 },
    promptHint:
      "先脱光图一女生的全部衣服和帽子、鞋袜手套，再让图1的女人穿上图2款式的衣服，保持图一角色脸部、发型、姿态角度不变",
  },
  {
    id: "dy-image-detail",
    platform: "抖音",
    kind: "image",
    name: "抖音详情页图",
    description: "竖版详情拼图，强调卖点与规格。",
    runningHub: imageRunningHubConfig(),
    defaults: { imageType: "详情页图", imageSize: "9:16 竖版", imageCount: 1 },
    promptHint:
      "先脱光图一女生的全部衣服和帽子、鞋袜手套，再让图1的女人穿上图2款式的衣服，保持图一角色脸部、发型、姿态角度不变",
  },
  {
    id: "xhs-image-main",
    platform: "小红书",
    kind: "image",
    name: "小红书 3:4 主图",
    description: "种草笔记首图比例。",
    runningHub: imageRunningHubConfig(),
    defaults: { imageType: "商品主图", imageSize: "3:4 小红书", imageCount: 1 },
    promptHint:
      "先脱光图一女生的全部衣服和帽子、鞋袜手套，再让图1的女人穿上图2款式的衣服，保持图一角色脸部、发型、姿态角度不变",
  },
  {
    id: "tb-image-detail",
    platform: "淘宝",
    kind: "image",
    name: "淘宝详情图组",
    description: "淘宝链路默认：主图+详情多图。",
    runningHub: imageRunningHubConfig(),
    defaults: { imageType: "详情页图", imageSize: "1:1 平台主图", imageCount: 1 },
    promptHint:
      "先脱光图一女生的全部衣服和帽子、鞋袜手套，再让图1的女人穿上图2款式的衣服，保持图一角色脸部、发型、姿态角度不变",
  },
  {
    id: "dy-copy-detail",
    platform: "抖音",
    kind: "copy",
    name: "抖店详情文案",
    description: "长文案 + 卖点提炼，用于商品详情页。",
    defaults: { copyType: "详情文案", versionCount: 2 },
    promptHint: "口语化、场景化，避免绝对化用语。",
  },
  {
    id: "dy-copy-publish",
    platform: "抖音",
    kind: "copy",
    name: "抖音发布文案",
    description: "短视频/图文发布标题与正文。",
    defaults: { copyType: "发布文案", versionCount: 3 },
    promptHint: "前 3 秒钩子 + 行动号召。",
  },
  {
    id: "xhs-copy-publish",
    platform: "小红书",
    kind: "copy",
    name: "小红书笔记文案",
    description: "标题 + 正文 + 话题占位。",
    defaults: { copyType: "发布文案", versionCount: 2 },
    promptHint: "第一人称种草，带 emoji 点缀。",
  },
  {
    id: "tb-copy-title",
    platform: "淘宝",
    kind: "copy",
    name: "淘宝标题与卖点",
    description: "搜索标题 + 核心卖点短句。",
    defaults: { copyType: "商品标题", versionCount: 2 },
    promptHint: "关键词前置，30 字内标题优先。",
  },
  {
    id: "dy-video-show",
    platform: "抖音",
    kind: "video",
    name: "抖音商品展示 9:16",
    description: "15 秒竖版展示视频。",
    runningHub: videoRunningHubConfig(),
    defaults: {
      videoType: "商品展示视频",
      videoRatio: "9:16 竖版",
      videoDuration: "7 秒",
      seconds: "7",
      frameRate: "30",
      expressionIntensity: "0.8",
      ruKilnAmplitude: "0.2",
    },
    promptHint: "",
  },
  {
    id: "xhs-video-note",
    platform: "小红书",
    kind: "video",
    name: "小红书种草视频",
    description: "竖版种草短视频。",
    runningHub: videoRunningHubConfig(),
    defaults: {
      videoType: "商品展示视频",
      videoRatio: "9:16 竖版",
      videoDuration: "7 秒",
      seconds: "7",
      frameRate: "30",
      expressionIntensity: "0.8",
      ruKilnAmplitude: "0.2",
    },
    promptHint: "",
  },
];

function listGenerationTemplates(filter = {}) {
  let list = DEFAULT_GENERATION_TEMPLATES.slice();
  if (filter.platform) list = list.filter((item) => item.platform === filter.platform);
  if (filter.kind) list = list.filter((item) => item.kind === filter.kind);
  return list;
}

function resolveGenerationTemplate(templateId, platform, kind) {
  if (templateId) {
    const hit = DEFAULT_GENERATION_TEMPLATES.find((item) => item.id === templateId);
    if (hit) return hit;
  }
  const byPlatform = DEFAULT_GENERATION_TEMPLATES.find(
    (item) => item.platform === platform && item.kind === kind
  );
  if (byPlatform) return byPlatform;
  return DEFAULT_GENERATION_TEMPLATES.find((item) => item.kind === kind) || null;
}

function pickTemplateForNode(node, platform) {
  if (node.generationTemplateId) {
    return resolveGenerationTemplate(node.generationTemplateId, platform, node.kind);
  }
  const copyType = node.params?.copyType;
  if (node.kind === "copy" && copyType) {
    const match = DEFAULT_GENERATION_TEMPLATES.find(
      (item) =>
        item.kind === "copy" && item.platform === platform && item.defaults?.copyType === copyType
    );
    if (match) return match;
  }
  if (node.kind === "image" && node.params?.imageType) {
    const match = DEFAULT_GENERATION_TEMPLATES.find(
      (item) =>
        item.kind === "image" &&
        item.platform === platform &&
        item.defaults?.imageType === node.params.imageType
    );
    if (match) return match;
  }
  return resolveGenerationTemplate("", platform, node.kind);
}

function mergeGenerationParams(template, base) {
  const merged = {
    ...(template?.defaults || {}),
    ...base,
  };
  if (template) {
    merged.generationTemplateId = template.id;
    merged.generationTemplateName = template.name;
    if (template.runningHubWorkflowId) {
      merged.runningHubWorkflowId = template.runningHubWorkflowId;
    }
    if (template.runningHub) {
      merged.runningHub = template.runningHub;
    }
    if (!merged.extraPrompt && template.promptHint) {
      merged.extraPrompt = template.promptHint;
    }
  }
  return merged;
}

function paramsFromRequest(body, kind, product) {
  const platform = String(body.platform || product?.platforms?.[0] || "抖音").trim();
  const base = defaultGenerationParams(kind, product || { platforms: [platform] });
  const manual = {};
  if (kind === "copy") {
    Object.assign(manual, {
      copyType: body.copyType,
      platform: body.platform || platform,
      versionCount: body.versionCount,
      extraPrompt: body.extraPrompt,
      accountId: body.accountId,
      accountName: body.accountName || body.account,
    });
  } else if (kind === "image") {
    Object.assign(manual, {
      imageType: body.imageType,
      imageSize: body.imageSize,
      imageCount: body.imageCount,
      extraPrompt: body.extraPrompt,
      referenceImageUrls: Array.isArray(body.referenceImageUrls) ? body.referenceImageUrls : [],
      modelImageUrls: Array.isArray(body.modelImageUrls) ? body.modelImageUrls : [],
      slot3Urls: Array.isArray(body.slot3Urls) ? body.slot3Urls : [],
    });
  } else if (kind === "video") {
    Object.assign(manual, {
      videoType: body.videoType,
      videoRatio: body.videoRatio,
      videoDuration: body.videoDuration,
      extraPrompt: body.extraPrompt || body.script,
      referenceImageUrls: Array.isArray(body.referenceImageUrls) ? body.referenceImageUrls : [],
      referenceVideoUrl: body.referenceVideoUrl,
      seconds: body.seconds,
      frameRate: body.frameRate,
      videoWidth: body.videoWidth,
      videoHeight: body.videoHeight,
      mode: body.mode,
      expressionIntensity: body.expressionIntensity,
      ruKilnAmplitude: body.ruKilnAmplitude,
    });
  }
  const template = resolveGenerationTemplate(body.generationTemplateId, platform, kind);
  return mergeGenerationParams(template, { ...base, platform, ...manual });
}

module.exports = {
  DEFAULT_GENERATION_TEMPLATES,
  listGenerationTemplates,
  resolveGenerationTemplate,
  pickTemplateForNode,
  mergeGenerationParams,
  paramsFromRequest,
};
