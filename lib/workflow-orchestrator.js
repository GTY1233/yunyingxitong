const NODE_CATALOG = [
  { key: "generate_copy", label: "生成文案", type: "generate", kind: "copy", category: "生成" },
  { key: "generate_image", label: "生成图片", type: "generate", kind: "image", category: "生成" },
  { key: "generate_video", label: "生成视频", type: "generate", kind: "video", category: "生成" },
  { key: "wait_confirm", label: "等待预览确认", type: "manual", category: "人工" },
  { key: "create_listing", label: "创建上架草稿", type: "listing", category: "上架" },
  { key: "create_publish", label: "创建发布任务", type: "publish", category: "发布" },
  { key: "auto_listing", label: "自动上架", type: "auto_listing", category: "上架" },
  { key: "auto_publish", label: "自动发布", type: "auto_publish", category: "发布" },
];

const CATALOG_BY_KEY = new Map(NODE_CATALOG.map((item) => [item.key, item]));

function getBuiltInTemplates() {
  return require("./workflow-engine").WORKFLOW_TEMPLATES;
}

function listNodeCatalog() {
  return NODE_CATALOG;
}

function normalizeStep(raw) {
  const key = typeof raw === "string" ? raw : raw?.key;
  const def = CATALOG_BY_KEY.get(key);
  if (!def) return null;
  return { key: def.key, label: def.label, type: def.type, kind: def.kind || "" };
}

function validateCustomSteps(steps) {
  if (!Array.isArray(steps) || !steps.length) {
    return { error: "至少需要一个节点" };
  }
  if (steps.length > 12) {
    return { error: "节点不能超过 12 个" };
  }

  const normalized = [];
  for (const raw of steps) {
    const step = normalizeStep(raw);
    if (!step) return { error: `未知节点：${raw?.key || raw}` };
    normalized.push(step);
  }

  const hasManual = normalized.some((item) => item.type === "manual");
  const autoNodes = normalized.filter((item) => ["auto_listing", "auto_publish"].includes(item.type));
  if (autoNodes.length && !hasManual) {
    return { error: "含自动上架/发布节点时，建议保留「等待预览确认」" };
  }

  return { ok: true, steps: normalized };
}

function inferWorkflowOptions(steps, options = {}) {
  const hasAuto = steps.some((item) => ["auto_listing", "auto_publish"].includes(item.type));
  const hasPublish = steps.some((item) => item.type === "publish");
  return {
    multiAccount: hasPublish ? options.multiAccount !== false : options.multiAccount === true,
    autoExecute: hasAuto ? options.autoExecute !== false : options.autoExecute === true,
  };
}

function resolveWorkflowTemplate(db, templateName) {
  const builtIn = getBuiltInTemplates();
  if (builtIn[templateName]) return builtIn[templateName];
  const custom = (db.customWorkflowTemplates || []).find(
    (item) => item.name === templateName || item.id === templateName
  );
  return custom?.steps || null;
}

function listAllWorkflowTemplates(db) {
  const builtInTemplates = getBuiltInTemplates();
  const builtIn = Object.keys(builtInTemplates).map((name) => ({
    name,
    steps: builtInTemplates[name].map((item) => item.label),
    stepCount: builtInTemplates[name].length,
    custom: false,
    builtin: true,
  }));
  const custom = (db.customWorkflowTemplates || []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description || "",
    steps: item.steps.map((step) => step.label),
    stepCount: item.steps.length,
    custom: true,
    builtin: false,
  }));
  return [...builtIn, ...custom];
}

function saveCustomWorkflowTemplate(db, body, helpers) {
  const validation = validateCustomSteps(body.steps);
  if (validation.error) return { error: validation.error };

  const name = String(body.name || "").trim();
  if (!name) return { error: "模板名称不能为空" };
  if (getBuiltInTemplates()[name]) return { error: "不能与内置模板重名" };

  db.customWorkflowTemplates = db.customWorkflowTemplates || [];

  const byId = body.id ? db.customWorkflowTemplates.find((item) => item.id === body.id) : null;
  const byName = db.customWorkflowTemplates.find((item) => item.name === name);
  const existing = byId || byName;

  if (existing) {
    if (byName && byName.id !== existing.id) return { error: "模板名称已存在" };
    existing.name = name;
    existing.description = String(body.description || "").trim();
    existing.steps = validation.steps;
    existing.updatedAt = helpers.formatNow();
    return { ok: true, template: existing };
  }

  if (db.customWorkflowTemplates.length >= 20) {
    return { error: "自定义模板最多 20 个" };
  }

  const template = {
    id: helpers.nextId(db.customWorkflowTemplates, "CT"),
    name,
    description: String(body.description || "").trim(),
    steps: validation.steps,
    createdAt: helpers.formatNow(),
    updatedAt: helpers.formatNow(),
  };
  db.customWorkflowTemplates.unshift(template);
  return { ok: true, template };
}

function deleteCustomWorkflowTemplate(db, templateId) {
  const list = db.customWorkflowTemplates || [];
  const index = list.findIndex((item) => item.id === templateId);
  if (index < 0) return { error: "模板不存在" };
  const removed = list.splice(index, 1)[0];
  return { ok: true, template: removed };
}

module.exports = {
  NODE_CATALOG,
  listNodeCatalog,
  validateCustomSteps,
  inferWorkflowOptions,
  resolveWorkflowTemplate,
  listAllWorkflowTemplates,
  saveCustomWorkflowTemplate,
  deleteCustomWorkflowTemplate,
};
