const COPY_TYPES = ["商品标题", "核心卖点", "详情文案", "视频脚本", "发布文案"];

const PLATFORM_TONE = {
  抖音: "口语化、节奏快、强调场景和转化",
  小红书: "种草感、生活方式、真实体验",
  淘宝: "信息完整、突出规格和性价比",
  拼多多: "实惠、实用、强调省钱",
  视频号: "亲切、可信、适合中老年用户",
  快手: "接地气、实在、强调真实使用",
};

function clampVersionCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 3;
  return Math.min(5, Math.max(1, Math.round(count)));
}

function normalizeCopyType(value) {
  const text = String(value || "").trim();
  return COPY_TYPES.includes(text) ? text : "发布文案";
}

function hasRealCopyApi() {
  return Boolean(process.env.COPY_API_KEY);
}

function buildPrompt(product, options) {
  const copyType = normalizeCopyType(options.copyType);
  const platform = String(options.platform || product.platforms?.[0] || "抖音").trim();
  const extraPrompt = String(options.extraPrompt || "").trim();
  const versionCount = clampVersionCount(options.versionCount);
  const tone = PLATFORM_TONE[platform] || "清晰、真实、适合电商转化";
  const accountPersona = String(options.accountPersona || "").trim();

  return `你是电商运营文案助手。请基于以下商品信息，生成 ${versionCount} 个不同风格的「${copyType}」，目标平台：${platform}。
写作风格：${tone}
${accountPersona ? `${accountPersona}\n请让文案明显符合该账号人设与发布习惯。\n` : ""}商品名称：${product.name}
类目：${product.category}
价格：${product.price} 元
卖点：${product.sellingPoints}
规格：${product.specs}
${extraPrompt ? `额外要求：${extraPrompt}` : ""}

输出要求：
1. 只输出 JSON 数组，每个元素是一条文案字符串
2. 不要夸大宣传，不要虚假承诺
3. 每条文案彼此风格要有差异
4. 不要输出 markdown 或其他说明文字`;

}

function parseVersionsFromText(text, fallbackBuilder) {
  const raw = String(text || "").trim();
  if (!raw) return fallbackBuilder();

  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    }
  } catch (error) {
    // fall through to line split
  }

  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/^\d+[\.\)、]\s*/, "").trim())
    .filter(Boolean);

  return lines.length ? lines : fallbackBuilder();
}

function templateVariant(product, copyType, platform, index, extraPrompt) {
  const { name, sellingPoints, specs, price, category } = product;
  const hook = sellingPoints.split(/[、，,]/)[0] || name;
  const suffix = extraPrompt ? `（${extraPrompt.slice(0, 24)}）` : "";

  const builders = {
    商品标题: [
      `${name}｜${hook}｜${category}好物`,
      `【${platform}热推】${name}，${hook}`,
      `${hook}必备！${name} 仅 ¥${price}`,
    ],
    核心卖点: [
      `1. ${hook}\n2. ${sellingPoints.split(/[、，,]/)[1] || "品质稳定"}\n3. ${specs}`,
      `核心优势：${sellingPoints}\n适合人群：${category}用户\n规格：${specs}`,
      `${name}为什么值得买？\n- ${sellingPoints.replace(/[、，,]/g, "\n- ")}`,
    ],
    详情文案: [
      `${name} 详情介绍\n\n【产品亮点】\n${sellingPoints}\n\n【规格参数】\n${specs}\n\n【适用场景】\n日常自用、送礼都合适。${suffix}`,
      `如果你正在找 ${category} 里的实用选择，${name} 会很合适。\n\n${sellingPoints}\n\n规格：${specs}\n价格：¥${price}`,
      `开箱第一眼就会被 ${hook} 吸引。\n\n${name} 采用 ${specs} 配置，${sellingPoints}。`,
    ],
    视频脚本: [
      `[0-3s] 开场：你是不是也在找 ${hook}？\n[3-10s] 展示：${name}，${sellingPoints}\n[10-15s] 转化：${specs}，现在下单更划算`,
      `镜头1：痛点提问\n镜头2：产品特写 + ${hook}\n镜头3：使用场景\n镜头4：价格 ¥${price} + 引导下单`,
      `口播：${name} 真的适合 ${platform} 种草。\n卖点：${sellingPoints}\n结尾：评论区告诉我你最关心哪一点。`,
    ],
    发布文案: [
      `${hook} 真的越用越香！${name}，${sellingPoints}。${suffix}`,
      `最近很多人在问 ${category} 怎么选，我投 ${name} 一票。${sellingPoints}，规格 ${specs}。`,
      `【${platform}分享】${name}\n${sellingPoints}\n适合：想提升日常体验的你`,
    ],
  };

  const pool = builders[copyType] || builders["发布文案"];
  return pool[index % pool.length];
}

function generateTemplateCopy(product, options) {
  const versionCount = clampVersionCount(options.versionCount);
  const copyType = normalizeCopyType(options.copyType);
  const platform = String(options.platform || product.platforms?.[0] || "抖音").trim();
  const extraPrompt = String(options.extraPrompt || "").trim();

  const versions = Array.from({ length: versionCount }, (_, index) =>
    templateVariant(product, copyType, platform, index, extraPrompt)
  );

  return {
    provider: "template",
    copyType,
    platform,
    versions,
  };
}

async function callCopyApi(product, options) {
  const versionCount = clampVersionCount(options.versionCount);
  const prompt = buildPrompt(product, { ...options, versionCount });
  const url = process.env.COPY_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.COPY_API_MODEL || "gpt-4o-mini";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.COPY_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      messages: [
        { role: "system", content: "你是专业的中文电商文案助手，只返回 JSON 数组。" },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Copy API error: ${response.status} ${detail.slice(0, 120)}`);
  }

  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content || "";
  const versions = parseVersionsFromText(text, () =>
    generateTemplateCopy(product, options).versions
  ).slice(0, versionCount);

  while (versions.length < versionCount) {
    versions.push(templateVariant(product, normalizeCopyType(options.copyType), options.platform, versions.length, options.extraPrompt));
  }

  return {
    provider: String(process.env.COPY_API_URL || "").includes("deepseek") ? "deepseek" : "api",
    copyType: normalizeCopyType(options.copyType),
    platform: String(options.platform || product.platforms?.[0] || "抖音").trim(),
    versions,
  };
}

async function generateCopy(product, options = {}) {
  if (hasRealCopyApi()) {
    return callCopyApi(product, options);
  }
  return generateTemplateCopy(product, options);
}

module.exports = {
  COPY_TYPES,
  generateCopy,
  hasRealCopyApi,
  normalizeCopyType,
  clampVersionCount,
};
