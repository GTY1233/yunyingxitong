// 合规引擎(纯函数,可单测)。规则数据在 rules.js。
// 三个用途:buildPromptRules(生成前注入)→ sanitizeText(生成后净化)→ checkProductForListing(上架前闸门)。
const { RULESETS, DEFAULT } = require("./rules");

function getRules(platform) {
  return RULESETS[String(platform || "").trim()] || DEFAULT;
}

// 扫描文本,返回命中的违规词(禁售款词 + 低俗词,去重)。
function checkText(text, rules) {
  const s = String(text || "");
  const violations = [];
  for (const word of rules.bannedProductWords) {
    if (s.includes(word)) violations.push({ word, type: "banned_product" });
  }
  for (const word of rules.vulgarWords) {
    if (s.includes(word)) violations.push({ word, type: "vulgar" });
  }
  return violations;
}

// 净化文本:按替换表(key 从长到短)把敏感词换成中性词;返回替换记录与残留违规。
// 禁售款词不做替换——那是「商品不能卖」,不是「换个说法」能解决的。
function sanitizeText(text, rules) {
  let out = String(text || "");
  const replaced = [];
  const keys = Object.keys(rules.neutralReplacements).sort((a, b) => b.length - a.length);
  for (const from of keys) {
    if (out.includes(from)) {
      const to = rules.neutralReplacements[from];
      out = out.split(from).join(to);
      replaced.push({ from, to });
    }
  }
  const residual = checkText(out, rules).filter((v) => v.type === "vulgar");
  return { text: out, replaced, residual };
}

// 生成 prompt 注入块(生成前遵守)。
function buildPromptRules(rules) {
  if (!rules.promptGuidelines.length) return "";
  return `内容合规红线(必须逐条遵守):\n${rules.promptGuidelines.map((g) => `- ${g}`).join("\n")}`;
}

// 上架前合规闸门:扫商品的名称/卖点/规格/类目。禁售款词或低俗词命中即拦。
function checkProductForListing(product, rules) {
  const fields = [
    ["商品名称", product.name],
    ["卖点", product.sellingPoints],
    ["规格", product.specs],
    ["类目", product.category],
  ];
  const violations = [];
  for (const [field, value] of fields) {
    for (const v of checkText(value, rules)) {
      violations.push({ ...v, field });
    }
  }
  const banned = violations.filter((v) => v.type === "banned_product");
  const vulgar = violations.filter((v) => v.type === "vulgar");
  if (!violations.length) return { ok: true, violations: [] };

  const parts = [];
  if (banned.length) {
    parts.push(
      `疑似禁售款(平台即便报白也禁售):${[...new Set(banned.map((v) => `${v.field}含「${v.word}」`))].join("、")}`
    );
  }
  if (vulgar.length) {
    parts.push(
      `敏感用词(建议换中性词如「纯欲风/辣妹穿搭」):${[...new Set(vulgar.map((v) => `${v.field}含「${v.word}」`))].join("、")}`
    );
  }
  return { ok: false, violations, message: parts.join(";") };
}

// 追加 AIGC 显式标识(幂等:已有则不重复)。
function appendAiLabel(text, rules) {
  const s = String(text || "");
  const suffix = rules.aiLabel?.textSuffix || "";
  if (!suffix || s.includes(suffix.trim())) return s;
  return s + suffix;
}

function aiNote(rules) {
  return rules.aiLabel?.note || "内容由AI辅助生成";
}

module.exports = {
  getRules,
  checkText,
  sanitizeText,
  buildPromptRules,
  checkProductForListing,
  appendAiLabel,
  aiNote,
};
