const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index <= 0) return;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    });
}

loadEnvFile();

const { enrichCopyParams } = require("./lib/account-utils");
const { generateCopy, normalizeCopyType, clampVersionCount } = require("./lib/copy-adapter");
const {
  applyStockSideEffects,
  deriveProductStatus,
  updateProductInventory,
  batchImportInventory,
  parseInventoryCsv,
} = require("./lib/inventory-service");
const {
  createListingTask,
  executeListingTask,
  retryListingTask,
  migrateListingTasks,
} = require("./lib/listing-service");
const {
  listPlatformCapabilities,
  migratePlatformFailures,
} = require("./lib/platform-service");
const { buildAnalyticsSummary } = require("./lib/analytics-service");
const {
  createPublishTask,
  executePublishTask,
  retryPublishTask,
  reschedulePublishTask,
  buildPublishExportPack,
  migratePublishTasks,
} = require("./lib/publish-service");
const {
  generateImages,
  hasRunningHubApi,
  normalizeImageType,
  clampImageCount,
} = require("./lib/image-adapter");
const { generateVideo, normalizeVideoType } = require("./lib/video-adapter");
const { computeListingCompleteness } = require("./lib/listing-check");
const { buildExportPack } = require("./lib/export-pack");
const {
  syncWorkflowSummaries,
  createWorkflowInstance,
  advanceWorkflow,
  onGenerationComplete,
  onGenerationFailed,
  confirmWorkflow,
  retryWorkflowNode,
  skipWorkflowNode,
  cancelWorkflow,
  batchCreateWorkflows,
} = require("./lib/workflow-engine");
const {
  autoRecognizeFields,
  pickPublishAsset,
  getEligibleAutoOpsProducts,
  startAutoOpsBatch,
  getContentAccounts,
  getDefaultAccount,
} = require("./lib/auto-ops-service");
const {
  buildProductStrategy,
  buildStrategySummary,
  applyStrategyAction,
  applyBatchStrategy,
} = require("./lib/strategy-service");
const {
  listNodeCatalog,
  listAllWorkflowTemplates,
  saveCustomWorkflowTemplate,
  deleteCustomWorkflowTemplate,
} = require("./lib/workflow-orchestrator");
const { buildTemplateAbReport, buildPreferredCopyParams } = require("./lib/template-ab-service");

const PORT = Number(process.env.PORT || 4173);
const DATA_DIR = path.join(ROOT, "data");
const GENERATED_DIR = path.join(DATA_DIR, "generated");
const DB_PATH = path.join(DATA_DIR, "db.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const DATA_KEYS = [
  "products",
  "workflows",
  "workflowInstances",
  "customWorkflowTemplates",
  "assets",
  "generationTasks",
  "listingTasks",
  "publishTasks",
  "accounts",
  "platformFailures",
  "logs",
];

const GENERATION_DELAYS = { copy: 1200, image: 2200, video: 4500 };
const GENERATION_FAILURE_RATE = { copy: 0.03, image: 0.08, video: 0.2 };
const scheduledGenerationJobs = new Map();

const RESOURCE_PREFIX = "/api/resources/";

function emptyDb() {
  return DATA_KEYS.reduce((db, key) => {
    db[key] = [];
    return db;
  }, {});
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function needsLegacyMigration(input) {
  if (Array.isArray(input?.reviews) && input.reviews.length) return true;
  if (
    Array.isArray(input?.assets) &&
    input.assets.some((asset) => LEGACY_ASSET_STATUS[asset.status] || asset.usage === "素材库")
  ) {
    return true;
  }
  if (
    Array.isArray(input?.products) &&
    input.products.some(
      (product) =>
        product.status === "待审核" ||
        ["imageStatus", "copyStatus", "videoStatus"].some((field) => LEGACY_KIND_STATUS[product[field]])
    )
  ) {
    return true;
  }
  return false;
}

function readDb() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) return emptyDb();

  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const db = normalizeDb(parsed);
    if (needsLegacyMigration(parsed)) {
      writeDb(db);
    }
    return db;
  } catch (error) {
    return emptyDb();
  }
}

const LEGACY_ASSET_STATUS = {
  待审核: "已生成",
  审核通过: "已生成",
  审核驳回: "生成失败",
};

const LEGACY_KIND_STATUS = {
  待审核: "已生成",
  审核通过: "已生成",
  审核驳回: "生成失败",
  生成成功: "已生成",
};

function migrateLegacyDb(db) {
  let changed = false;

  db.assets.forEach((asset) => {
    if (LEGACY_ASSET_STATUS[asset.status]) {
      asset.status = LEGACY_ASSET_STATUS[asset.status];
      changed = true;
    }
    if (asset.usage === "素材库") {
      asset.usage = "成品库";
      changed = true;
    }
  });

  db.products.forEach((product) => {
    if (product.status === "待审核") {
      product.status = "待发布";
      changed = true;
    }
    ["imageStatus", "copyStatus", "videoStatus"].forEach((field) => {
      if (LEGACY_KIND_STATUS[product[field]]) {
        product[field] = LEGACY_KIND_STATUS[product[field]];
        changed = true;
      }
    });
  });

  return changed;
}

function normalizeDb(input) {
  const db = emptyDb();
  DATA_KEYS.forEach((key) => {
    db[key] = Array.isArray(input && input[key]) ? input[key] : [];
  });
  migrateLegacyDb(db);
  migratePublishTasks(db);
  migrateListingTasks(db);
  migratePlatformFailures(db);
  return db;
}

function writeDb(input) {
  ensureDataDir();
  const db = normalizeDb(input);
  fs.writeFileSync(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  return db;
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function parseJsonBody(body) {
  if (!body) return {};
  return JSON.parse(body);
}

function nextId(items, prefix) {
  const max = items.reduce((current, item) => {
    const id = String(item.id || "");
    if (!id.startsWith(prefix)) return current;
    const number = Number(id.slice(prefix.length));
    return Number.isFinite(number) ? Math.max(current, number) : current;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function getProduct(db, productId) {
  return db.products.find((product) => product.id === productId);
}

function getAsset(db, assetId) {
  return db.assets.find((asset) => asset.id === assetId);
}

function formatNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function addLog(db, productId, text, action) {
  db.logs.unshift({
    productId,
    text,
    time: formatNow(),
    action: action || "general",
  });
}

function inferKindFromType(type) {
  const text = String(type || "");
  if (["文案", "标题", "脚本", "卖点", "口播"].some((key) => text.includes(key))) return "copy";
  if (text.includes("视频")) return "video";
  return "image";
}

function nextAssetVersion(db, productId, type) {
  const count = db.assets.filter((asset) => asset.productId === productId && asset.type === type).length;
  return `v${count + 1}`;
}

function getWorkflowHelpers() {
  const publishHelpers = getPublishHelpers();
  return {
    nextId,
    formatNow,
    addLog,
    createGenerationTask,
    scheduleGenerationTask,
    createPublishTask: (db, product, body, asset) => createPublishTask(db, product, body, asset, publishHelpers),
    createListingTask: (db, product, body) => createListingTask(db, product, body, publishHelpers),
    executeListingTask,
    executePublishTask,
    pickPublishAsset,
    getContentAccounts,
    getDefaultAccount,
  };
}

function workflowOptionsFromBody(body = {}) {
  return {
    multiAccount: body.multiAccount,
    autoExecute: body.autoExecute,
  };
}

function getPublishHelpers() {
  return { nextId, formatNow, addLog };
}

function notifyWorkflowAfterGeneration(db, task, success) {
  if (!task) return;
  const helpers = getWorkflowHelpers();
  if (success) {
    onGenerationComplete(db, task.productId, task.kind, helpers);
  } else {
    onGenerationFailed(db, task.productId, task.kind, task.error || "生成失败", helpers);
  }
  syncWorkflowSummaries(db);
}

function kindToStatusField(kind) {
  if (kind === "copy") return "copyStatus";
  if (kind === "video") return "videoStatus";
  return "imageStatus";
}

function syncProductAfterGeneration(product) {
  if (["已上架", "已发布", "已暂停"].includes(product.status)) return;
  const statuses = [product.imageStatus, product.copyStatus, product.videoStatus];
  if (statuses.some((status) => status === "生成中")) {
    product.status = "生成中";
    return;
  }
  if (statuses.some((status) => status === "已生成")) {
    product.status = "待发布";
  }
}

function parseStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,、，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultProductFields(body, db) {
  const name = String(body.name || "").trim() || "未命名商品";
  const stock = Number.isFinite(Number(body.stock)) ? Number(body.stock) : 0;
  const warningStock = Number.isFinite(Number(body.warningStock)) ? Number(body.warningStock) : 20;
  const price = Number.isFinite(Number(body.price)) ? Number(body.price) : 0;
  const platforms = parseStringList(body.platforms);
  const accounts = parseStringList(body.accounts);
  const hasBasics = name !== "未命名商品" && platforms.length > 0;

  return {
    name,
    code: String(body.code || "").trim() || `SKU-DRAFT-${db.products.length + 1}`,
    category: String(body.category || "").trim() || "待识别",
    price,
    stock,
    warningStock,
    platforms: platforms.length ? platforms : ["待选择"],
    accounts: accounts.length ? accounts : ["未绑定"],
    sellingPoints: String(body.sellingPoints || "").trim() || "待补充商品卖点。",
    specs: String(body.specs || "").trim() || "待补充",
    status: hasBasics ? "待生成" : "待完善",
    imageStatus: "未生成",
    copyStatus: "未生成",
    videoStatus: "未生成",
    listingStatus: "未上架",
    publishStatus: "未发布",
    progress: hasBasics ? 18 : 8,
    updatedAt: "刚刚",
    colors: Array.isArray(body.colors) && body.colors.length === 2 ? body.colors : ["#e2e8f0", "#93c5fd"],
  };
}


function summarizeProductChanges(before, after) {
  const labels = {
    name: "商品名称",
    code: "商品编号",
    category: "类目",
    price: "价格",
    stock: "库存",
    warningStock: "预警库存",
    sellingPoints: "卖点",
    specs: "规格",
  };
  const changes = [];

  Object.keys(labels).forEach((key) => {
    if (before[key] !== after[key]) changes.push(labels[key]);
  });

  if (JSON.stringify(before.platforms) !== JSON.stringify(after.platforms)) changes.push("目标平台");
  if (JSON.stringify(before.accounts) !== JSON.stringify(after.accounts)) changes.push("绑定账号");
  return changes;
}

function inferResourcePrefix(resource) {
  const prefixes = {
    products: "P",
    workflows: "W",
    workflowInstances: "WF",
    assets: "A",
    generationTasks: "GT",
    listingTasks: "L",
    publishTasks: "PUB",
    accounts: "AC",
    platformFailures: "PF",
    logs: "LOG",
  };
  return prefixes[resource] || "ID";
}

function generationKindMeta(kind, params = {}) {
  const typeMap = {
    image: ["主图", "AI 图片"],
    copy: ["发布文案", "AI 文案"],
    video: ["短视频", "AI 视频"],
  };
  if (kind === "copy" && params.copyType) {
    return { type: normalizeCopyType(params.copyType), label: "AI 文案" };
  }
  if (kind === "image" && params.imageType) {
    return { type: normalizeImageType(params.imageType), label: "AI 图片" };
  }
  if (kind === "video" && params.videoType) {
    return { type: normalizeVideoType(params.videoType), label: "AI 视频" };
  }
  const [type, label] = typeMap[kind] || typeMap.image;
  return { type, label };
}

function buildGenerationParams(body, kind) {
  if (kind === "copy") {
    return {
      copyType: normalizeCopyType(body.copyType),
      platform: String(body.platform || "").trim(),
      versionCount: clampVersionCount(body.versionCount),
      extraPrompt: String(body.extraPrompt || "").trim(),
      accountId: String(body.accountId || "").trim(),
      accountName: String(body.accountName || body.account || "").trim(),
    };
  }
  if (kind === "image") {
    return {
      imageType: normalizeImageType(body.imageType),
      imageSize: String(body.imageSize || "1:1 平台主图").trim(),
      imageCount: clampImageCount(body.imageCount),
      extraPrompt: String(body.extraPrompt || "").trim(),
    };
  }
  if (kind === "video") {
    return {
      videoType: normalizeVideoType(body.videoType),
      videoRatio: String(body.videoRatio || "9:16 竖版").trim(),
      videoDuration: String(body.videoDuration || "15 秒").trim(),
      extraPrompt: String(body.extraPrompt || body.script || "").trim(),
    };
  }
  return {};
}

function createImageAssets(db, product, task, result) {
  const created = [];
  const hasPrimary = db.assets.some((item) => item.productId === product.id && item.isPrimary);

  result.images.forEach((image, index) => {
    const asset = {
      id: nextId(db.assets, "A"),
      productId: product.id,
      name: `${product.name}${task.type} ${db.assets.filter((item) => item.productId === product.id && item.type === task.type).length + index + 1}`,
      type: task.type,
      status: "已生成",
      usage: "成品库",
      version: nextAssetVersion(db, product.id, task.type),
      kind: "image",
      source: "generated",
      content: "",
      imageUrl: image.url,
      imageType: result.imageType,
      aspectRatio: result.aspectRatio,
      provider: result.provider,
      isPrimary: !hasPrimary && index === 0,
      generationTaskId: task.id,
    };
    db.assets.unshift(asset);
    created.push(asset);
  });

  return created;
}

function createGenerationTask(db, product, kind, params = {}) {
  const resolvedParams = kind === "copy" ? enrichCopyParams(db, product, params) : params;
  const { type, label } = generationKindMeta(kind, resolvedParams);
  const task = {
    id: nextId(db.generationTasks, "GT"),
    productId: product.id,
    productName: product.name,
    kind,
    type,
    label,
    params: resolvedParams,
    status: "待执行",
    assetId: "",
    assetName: "",
    error: "",
    attempts: 1,
    maxAttempts: 3,
    createdAt: formatNow(),
    updatedAt: formatNow(),
    startedAt: "",
    finishedAt: "",
  };
  db.generationTasks.unshift(task);
  product[kindToStatusField(kind)] = "生成中";
  syncProductAfterGeneration(product);
  const detail =
    kind === "copy"
      ? `${type} / ${resolvedParams.platform || product.platforms[0] || "抖音"}${resolvedParams.accountName ? ` / ${resolvedParams.accountName}` : ""}`
      : kind === "image"
        ? `${type} / ${params.imageCount || 1} 张`
        : kind === "video"
          ? `${type} / ${params.videoDuration || "15 秒"}`
          : label;
  addLog(db, product.id, `[生成] ${detail}任务已创建（${task.id}）`, "generation");
  return task;
}

async function finishGenerationTask(taskId) {
  const db = readDb();
  const task = db.generationTasks.find((item) => item.id === taskId);
  if (!task || task.status !== "执行中") return;

  const product = getProduct(db, task.productId);
  if (!product) {
    task.status = "失败";
    task.error = "商品不存在";
    task.finishedAt = formatNow();
    task.updatedAt = formatNow();
    writeDb(db);
    return;
  }

  const failRate = GENERATION_FAILURE_RATE[task.kind] || 0;
  const forceFail = process.env.FORCE_GENERATION_FAIL === "1";

  let asset = {
    id: nextId(db.assets, "A"),
    productId: product.id,
    name: `${product.name}${task.label} ${db.assets.filter((item) => item.productId === product.id && item.type === task.type).length + 1}`,
    type: task.type,
    status: "已生成",
    usage: "成品库",
    version: nextAssetVersion(db, product.id, task.type),
    kind: task.kind === "copy" ? "copy" : task.kind,
    source: "generated",
    content: "",
    generationTaskId: task.id,
  };

  if (task.kind === "copy") {
    try {
      if (forceFail || Math.random() < failRate) {
        throw new Error("文案生成服务暂时不可用");
      }
      const result = await generateCopy(product, task.params || {});
      asset.content = result.versions[0] || "";
      asset.variants = result.variants;
      asset.copyType = result.copyType;
      asset.platform = result.platform;
      asset.provider = result.provider;
      task.provider = result.provider;
      db.assets.unshift(asset);
      task.status = "已成功";
      task.assetId = asset.id;
      task.assetName = asset.name;
      task.error = "";
      task.finishedAt = formatNow();
      task.updatedAt = formatNow();
      product[kindToStatusField(task.kind)] = "已生成";
      syncProductAfterGeneration(product);
      const versionNote = asset.variants?.length > 1 ? `，共 ${asset.variants.length} 个版本` : "";
      addLog(db, product.id, `[生成] ${task.type}完成，成品「${asset.name}」已保存${versionNote}（${task.id}）`, "generation");
      notifyWorkflowAfterGeneration(db, task, true);
      writeDb(db);
      return;
    } catch (error) {
      task.status = "失败";
      task.error = error.message || "文案生成失败";
      task.finishedAt = formatNow();
      task.updatedAt = formatNow();
      product[kindToStatusField(task.kind)] = "生成失败";
      syncProductAfterGeneration(product);
      addLog(db, product.id, `[生成] ${task.type}失败：${task.error}（${task.id}）`, "generation");
      notifyWorkflowAfterGeneration(db, task, false);
      writeDb(db);
      return;
    }
  } else if (task.kind === "image") {
    try {
      if (forceFail || (!hasRunningHubApi() && Math.random() < failRate)) {
        throw new Error("图片生成服务暂时不可用");
      }
      const result = await generateImages(product, task.params || {}, { taskId: task.id, rootDir: ROOT });
      const createdAssets = createImageAssets(db, product, task, result);
      task.status = "已成功";
      task.assetId = createdAssets[0]?.id || "";
      task.assetName = createdAssets.length > 1 ? `${createdAssets.length}张${task.type}` : createdAssets[0]?.name || "";
      task.provider = result.provider;
      task.imageCount = createdAssets.length;
      task.error = "";
      task.finishedAt = formatNow();
      task.updatedAt = formatNow();
      product[kindToStatusField(task.kind)] = "已生成";
      syncProductAfterGeneration(product);
      addLog(db, product.id, `[生成] ${task.type}完成，新增 ${createdAssets.length} 张图片到成品库（${task.id}）`, "generation");
      notifyWorkflowAfterGeneration(db, task, true);
      writeDb(db);
      return;
    } catch (error) {
      task.status = "失败";
      task.error = error.message || "图片生成失败";
      task.finishedAt = formatNow();
      task.updatedAt = formatNow();
      product[kindToStatusField(task.kind)] = "生成失败";
      syncProductAfterGeneration(product);
      addLog(db, product.id, `[生成] ${task.type}失败：${task.error}（${task.id}）`, "generation");
      notifyWorkflowAfterGeneration(db, task, false);
      writeDb(db);
      return;
    }
  } else if (task.kind === "video") {
    try {
      if (forceFail || (!hasRunningHubApi() && Math.random() < failRate)) {
        throw new Error("视频渲染超时，请重试");
      }
      const result = await generateVideo(product, task.params || {}, { taskId: task.id, rootDir: ROOT });
      asset.content = result.script || "";
      asset.videoUrl = result.videoUrl || "";
      asset.posterUrl = result.posterUrl || "";
      asset.videoType = result.videoType;
      asset.aspectRatio = result.aspectRatio;
      asset.duration = result.duration;
      asset.provider = result.provider;
      task.provider = result.provider;
      db.assets.unshift(asset);
      task.status = "已成功";
      task.assetId = asset.id;
      task.assetName = asset.name;
      task.error = "";
      task.finishedAt = formatNow();
      task.updatedAt = formatNow();
      product[kindToStatusField(task.kind)] = "已生成";
      syncProductAfterGeneration(product);
      addLog(db, product.id, `[生成] ${task.type}完成，成品「${asset.name}」已保存（${task.id}）`, "generation");
      notifyWorkflowAfterGeneration(db, task, true);
      writeDb(db);
      return;
    } catch (error) {
      task.status = "失败";
      task.error = error.message || "视频生成失败";
      task.finishedAt = formatNow();
      task.updatedAt = formatNow();
      product[kindToStatusField(task.kind)] = "生成失败";
      syncProductAfterGeneration(product);
      addLog(db, product.id, `[生成] ${task.type}失败：${task.error}（${task.id}）`, "generation");
      notifyWorkflowAfterGeneration(db, task, false);
      writeDb(db);
      return;
    }
  }

  task.status = "失败";
  task.error = "未知生成类型";
  task.finishedAt = formatNow();
  task.updatedAt = formatNow();
  product[kindToStatusField(task.kind)] = "生成失败";
  syncProductAfterGeneration(product);
  writeDb(db);
}

function scheduleGenerationTask(taskId) {
  if (scheduledGenerationJobs.has(taskId)) return;

  const db = readDb();
  const task = db.generationTasks.find((item) => item.id === taskId);
  if (!task || task.status !== "待执行") return;

  task.status = "执行中";
  task.startedAt = formatNow();
  task.updatedAt = formatNow();
  writeDb(db);

  const delay =
    (task.kind === "image" || task.kind === "video") && hasRunningHubApi()
      ? 0
      : GENERATION_DELAYS[task.kind] || 2000;
  const timer = setTimeout(() => {
    scheduledGenerationJobs.delete(taskId);
    finishGenerationTask(taskId).catch((error) => {
      const latest = readDb();
      const current = latest.generationTasks.find((item) => item.id === taskId);
      if (!current || current.status !== "执行中") return;
      current.status = "失败";
      current.error = error.message || "生成任务执行异常";
      current.finishedAt = formatNow();
      current.updatedAt = formatNow();
      const product = getProduct(latest, current.productId);
      if (product) {
        product[kindToStatusField(current.kind)] = "生成失败";
        syncProductAfterGeneration(product);
      }
      notifyWorkflowAfterGeneration(latest, current, false);
      writeDb(latest);
    });
  }, delay);
  scheduledGenerationJobs.set(taskId, timer);
}

function retryGenerationTask(db, taskId) {
  const task = db.generationTasks.find((item) => item.id === taskId);
  if (!task) return { error: "Task not found" };
  if (task.status !== "失败") return { error: "Only failed tasks can be retried" };
  if (task.attempts >= task.maxAttempts) return { error: "Max retry attempts reached" };

  const product = getProduct(db, task.productId);
  if (!product) return { error: "Product not found" };

  task.status = "待执行";
  task.error = "";
  task.attempts += 1;
  task.updatedAt = formatNow();
  task.startedAt = "";
  task.finishedAt = "";
  product[kindToStatusField(task.kind)] = "生成中";
  syncProductAfterGeneration(product);
  addLog(db, product.id, `[生成] 重试任务 ${task.id}（第 ${task.attempts} 次）`, "generation");
  writeDb(db);
  scheduleGenerationTask(taskId);
  return { ok: true };
}

function resumePendingGenerationTasks() {
  const db = readDb();
  let changed = false;

  db.generationTasks.forEach((task) => {
    if (task.status === "执行中") {
      task.status = "待执行";
      task.updatedAt = formatNow();
      changed = true;
    }
  });

  if (changed) writeDb(db);

  readDb()
    .generationTasks.filter((task) => task.status === "待执行")
    .forEach((task) => scheduleGenerationTask(task.id));
}

function sendSavedState(res, db, message) {
  sendJson(res, 200, { ok: true, message, data: writeDb(db) });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const cleanPath = decoded === "/" ? "/index.html" : decoded;
  const filePath = path.normalize(path.join(ROOT, cleanPath));
  if (!filePath.startsWith(ROOT)) return null;
  return filePath;
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && req.url === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "yunyingxitong-mvp",
      copyProvider: process.env.COPY_API_KEY
        ? String(process.env.COPY_API_URL || "").includes("deepseek")
          ? "deepseek"
          : "api"
        : "template",
      imageProvider: hasRunningHubApi() ? "runninghub" : "template",
      videoProvider: hasRunningHubApi() ? "runninghub" : "template",
    });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/state") {
    sendJson(res, 200, readDb());
    return true;
  }

  if (req.method === "POST" && req.url === "/api/state") {
    try {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, data: writeDb(JSON.parse(body || "{}")) });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (url.pathname.startsWith(RESOURCE_PREFIX)) {
    const parts = url.pathname.slice(RESOURCE_PREFIX.length).split("/").filter(Boolean);
    const resource = parts[0];
    const id = parts[1];

    if (!DATA_KEYS.includes(resource)) {
      sendJson(res, 404, { ok: false, error: "Resource not found" });
      return true;
    }

    const db = readDb();

    if (req.method === "GET" && !id) {
      sendJson(res, 200, { ok: true, data: db[resource] });
      return true;
    }

    if (req.method === "POST" && !id) {
      try {
        const body = parseJsonBody(await readBody(req));
        db[resource].unshift({
          ...body,
          id: body.id || nextId(db[resource], inferResourcePrefix(resource)),
        });
        sendSavedState(res, db, "Resource created");
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return true;
    }

    if (req.method === "PATCH" && id) {
      try {
        const body = parseJsonBody(await readBody(req));
        const index = db[resource].findIndex((item) => item.id === id);
        if (index < 0) {
          sendJson(res, 404, { ok: false, error: "Item not found" });
          return true;
        }
        db[resource][index] = { ...db[resource][index], ...body };
        sendSavedState(res, db, "Resource updated");
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return true;
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/generate") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const product = getProduct(db, body.productId);
      const kind = ["image", "copy", "video"].includes(body.kind) ? body.kind : "image";
      const params = buildGenerationParams(body, kind);

      if (!product) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }

      const task = createGenerationTask(db, product, kind, params);
      writeDb(db);
      scheduleGenerationTask(task.id);
      sendJson(res, 200, {
        ok: true,
        message: "Generation task created",
        taskId: task.id,
        data: readDb(),
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const generationRetryMatch = url.pathname.match(/^\/api\/actions\/generation-tasks\/([^/]+)\/retry$/);
  if (req.method === "POST" && generationRetryMatch) {
    try {
      const db = readDb();
      const result = retryGenerationTask(db, generationRetryMatch[1]);
      if (result.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      sendSavedState(res, readDb(), "Generation task retried");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/assets") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const product = getProduct(db, body.productId);

      if (!product) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }

      const type = String(body.type || "主图").trim();
      const kind = ["image", "copy", "video"].includes(body.kind) ? body.kind : inferKindFromType(type);
      const name = String(body.name || "").trim() || `${product.name}${type}`;
      const asset = {
        id: nextId(db.assets, "A"),
        productId: product.id,
        name,
        type,
        kind,
        status: "已生成",
        usage: String(body.usage || "成品库").trim(),
        version: String(body.version || nextAssetVersion(db, product.id, type)),
        source: "manual",
        content: String(body.content || "").trim(),
      };

      db.assets.unshift(asset);
      product[kindToStatusField(kind)] = "已生成";
      syncProductAfterGeneration(product);
      addLog(db, product.id, `[成品] 登记${kind === "copy" ? "文案" : kind === "video" ? "视频" : "图片"}「${asset.name}」`, "asset");
      sendSavedState(res, db, "Asset registered");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const assetUpdateMatch = url.pathname.match(/^\/api\/actions\/assets\/([^/]+)$/);
  if (req.method === "PATCH" && assetUpdateMatch) {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const asset = getAsset(db, assetUpdateMatch[1]);

      if (!asset) {
        sendJson(res, 404, { ok: false, error: "Asset not found" });
        return true;
      }

      if (body.content !== undefined) {
        asset.content = String(body.content).trim();
      }

      if (body.selectedVariant !== undefined && Array.isArray(asset.variants)) {
        const index = Number(body.selectedVariant);
        if (Number.isFinite(index) && asset.variants[index]) {
          asset.selectedVariant = index;
          asset.content = asset.variants[index];
        }
      }

      if (Array.isArray(body.variants)) {
        asset.variants = body.variants.map((item) => String(item).trim()).filter(Boolean);
        if (asset.variants.length) {
          asset.content = asset.variants[asset.selectedVariant || 0] || asset.variants[0];
        }
      }

      addLog(db, asset.productId, `[成品] 更新文案「${asset.name}」`, "asset");
      sendSavedState(res, db, "Asset updated");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const assetPrimaryMatch = url.pathname.match(/^\/api\/actions\/assets\/([^/]+)\/set-primary$/);
  if (req.method === "POST" && assetPrimaryMatch) {
    try {
      const db = readDb();
      const asset = getAsset(db, assetPrimaryMatch[1]);
      if (!asset || asset.kind !== "image") {
        sendJson(res, 400, { ok: false, error: "Only image assets can be set as primary" });
        return true;
      }
      db.assets.forEach((item) => {
        if (item.productId === asset.productId && item.kind === "image") {
          item.isPrimary = item.id === asset.id;
        }
      });
      addLog(db, asset.productId, `[成品] 已将「${asset.name}」设为主图`, "asset");
      sendSavedState(res, db, "Primary image updated");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/publish-from-asset") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const asset = getAsset(db, body.assetId);

      if (!asset) {
        sendJson(res, 404, { ok: false, error: "Asset not found" });
        return true;
      }

      const product = getProduct(db, asset.productId);
      if (!product) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }

      const task = createPublishTask(db, product, body, asset, getPublishHelpers());
      addLog(db, product.id, `[发布] 成品「${asset.name}」已创建发布任务（${task.platform}）`, "publish");
      sendSavedState(res, db, "Publish task created from asset");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/publish-tasks") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const product = getProduct(db, body.productId);

      if (!product) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }

      const asset = body.assetId ? getAsset(db, body.assetId) : null;
      const task = createPublishTask(db, product, body, asset, getPublishHelpers());
      addLog(db, product.id, `[发布] 已创建发布任务（${task.account} / ${task.time}）`, "publish");
      sendSavedState(res, db, "Publish task created");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const publishTaskMatch = url.pathname.match(/^\/api\/actions\/publish-tasks\/([^/]+)\/(execute|retry|reschedule)$/);
  if (req.method === "POST" && publishTaskMatch) {
    try {
      const db = readDb();
      const taskId = publishTaskMatch[1];
      const action = publishTaskMatch[2];
      const body = action === "reschedule" ? parseJsonBody(await readBody(req)) : {};
      const helpers = getPublishHelpers();
      let result;
      if (action === "execute") result = executePublishTask(db, taskId, helpers);
      else if (action === "retry") result = retryPublishTask(db, taskId, helpers);
      else result = reschedulePublishTask(db, taskId, body, helpers);
      if (result.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      sendSavedState(res, db, `Publish task ${action}`);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const publishExportMatch = url.pathname.match(/^\/api\/actions\/publish-tasks\/([^/]+)\/export$/);
  if (req.method === "GET" && publishExportMatch) {
    try {
      const db = readDb();
      const pack = buildPublishExportPack(db, publishExportMatch[1], getProduct, getAsset);
      if (!pack) {
        sendJson(res, 404, { ok: false, error: "Publish task not found" });
        return true;
      }
      const fileName = `${pack.product.code || pack.product.id}-publish-${publishExportMatch[1]}.json`;
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      });
      res.end(`${JSON.stringify(pack, null, 2)}\n`);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/accounts") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const name = String(body.name || "").trim();
      if (!name) {
        sendJson(res, 400, { ok: false, error: "账号名称不能为空" });
        return true;
      }
      if ((db.accounts || []).some((item) => item.name === name)) {
        sendJson(res, 400, { ok: false, error: "账号名称已存在" });
        return true;
      }
      const account = {
        id: nextId(db.accounts, "AC"),
        platform: String(body.platform || "抖音").trim(),
        name,
        type: ["店铺账号", "内容账号"].includes(body.type) ? body.type : "内容账号",
        auth: String(body.auth || "已授权").trim(),
        rule: String(body.rule || "每天最多 3 条").trim(),
        persona: String(body.persona || "通用种草").trim(),
      };
      db.accounts.unshift(account);
      addLog(db, db.products[0]?.id || "", `[账号] 已绑定「${account.name}」`, "account");
      sendSavedState(res, db, "Account created");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/listing-tasks") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const product = getProduct(db, body.productId);

      if (!product) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }

      createListingTask(db, product, body, getPublishHelpers());
      sendSavedState(res, db, "Listing draft created");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const listingTaskMatch = url.pathname.match(/^\/api\/actions\/listing-tasks\/([^/]+)\/(execute|retry)$/);
  if (req.method === "POST" && listingTaskMatch) {
    try {
      const db = readDb();
      const taskId = listingTaskMatch[1];
      const action = listingTaskMatch[2];
      const helpers = getPublishHelpers();
      const result = action === "execute" ? executeListingTask(db, taskId, helpers) : retryListingTask(db, taskId, helpers);
      if (result.error && !result.task) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      sendSavedState(res, db, `Listing task ${action}`);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/platforms/capabilities") {
    sendJson(res, 200, { ok: true, platforms: listPlatformCapabilities() });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/analytics/summary") {
    try {
      const db = readDb();
      sendJson(res, 200, { ok: true, analytics: buildAnalyticsSummary(db) });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/strategy/summary") {
    try {
      const db = readDb();
      sendJson(res, 200, { ok: true, strategy: buildStrategySummary(db) });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const strategyProductMatch = url.pathname.match(/^\/api\/strategy\/product\/([^/]+)$/);
  if (req.method === "GET" && strategyProductMatch) {
    try {
      const db = readDb();
      const strategy = buildProductStrategy(db, strategyProductMatch[1]);
      if (strategy.error) {
        sendJson(res, 404, { ok: false, error: strategy.error });
        return true;
      }
      sendJson(res, 200, { ok: true, strategy });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/strategy/apply") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      if (!body.productId) {
        sendJson(res, 400, { ok: false, error: "productId required" });
        return true;
      }
      const result = applyStrategyAction(db, body.productId, body, getWorkflowHelpers(), {
        createWorkflowInstance,
        advanceWorkflow,
      });
      if (result.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      sendSavedState(res, db, result.message || "Strategy applied");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/strategy/batch-apply") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const result = applyBatchStrategy(db, body, getWorkflowHelpers(), {
        createWorkflowInstance,
        advanceWorkflow,
      });
      if (result.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      sendSavedState(res, db, result.message || "Batch strategy applied");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/actions/export-pack") {
    try {
      const db = readDb();
      const productId = url.searchParams.get("productId");
      const pack = buildExportPack(db, productId);
      if (!pack) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }
      const fileName = `${pack.product.code || productId}-export.json`;
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      });
      res.end(`${JSON.stringify(pack, null, 2)}\n`);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/workflows/templates") {
    try {
      const db = readDb();
      sendJson(res, 200, { ok: true, templates: listAllWorkflowTemplates(db) });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/workflows/node-catalog") {
    sendJson(res, 200, { ok: true, nodes: listNodeCatalog() });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/workflows/custom-templates") {
    try {
      const db = readDb();
      sendJson(res, 200, { ok: true, templates: db.customWorkflowTemplates || [] });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/workflows/custom-templates") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const result = saveCustomWorkflowTemplate(db, body, { nextId, formatNow });
      if (result.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      writeDb(db);
      sendJson(res, 200, { ok: true, template: result.template, message: "Custom workflow saved" });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const customWorkflowMatch = url.pathname.match(/^\/api\/workflows\/custom-templates\/([^/]+)$/);
  if (req.method === "DELETE" && customWorkflowMatch) {
    try {
      const db = readDb();
      const result = deleteCustomWorkflowTemplate(db, customWorkflowMatch[1]);
      if (result.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      writeDb(db);
      sendJson(res, 200, { ok: true, message: "Custom workflow deleted" });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/analytics/template-ab") {
    try {
      const db = readDb();
      sendJson(res, 200, { ok: true, templateAb: buildTemplateAbReport(db) });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/workflows/batch") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const productIds = Array.isArray(body.productIds) ? body.productIds : [];
      const result = batchCreateWorkflows(
        db,
        productIds,
        body.template || "新品半自动",
        getWorkflowHelpers(),
        workflowOptionsFromBody(body)
      );
      sendSavedState(res, db, `Started ${result.count} workflows`);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/workflows") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const result = createWorkflowInstance(
        db,
        body.productId,
        body.template || "新品半自动",
        getWorkflowHelpers(),
        workflowOptionsFromBody(body)
      );
      if (result.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      advanceWorkflow(db, result.instance.id, getWorkflowHelpers());
      sendSavedState(res, db, "Workflow started");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const workflowMatch = url.pathname.match(/^\/api\/actions\/workflows\/([^/]+)\/(confirm|retry|skip|advance|cancel)$/);
  if (req.method === "POST" && workflowMatch) {
    try {
      const db = readDb();
      const workflowId = workflowMatch[1];
      const action = workflowMatch[2];
      const helpers = getWorkflowHelpers();
      let result;
      if (action === "confirm") result = confirmWorkflow(db, workflowId, helpers);
      else if (action === "retry") result = retryWorkflowNode(db, workflowId, helpers);
      else if (action === "skip") result = skipWorkflowNode(db, workflowId, helpers);
      else if (action === "cancel") result = cancelWorkflow(db, workflowId, helpers);
      else result = advanceWorkflow(db, workflowId, helpers);
      if (result.error) {
        sendJson(res, 400, { ok: false, error: result.error });
        return true;
      }
      sendSavedState(res, db, "Workflow updated");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/auto-ops/eligible") {
    const db = readDb();
    sendJson(res, 200, {
      ok: true,
      products: getEligibleAutoOpsProducts(db).map((item) => ({ id: item.id, name: item.name, stock: item.stock })),
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/auto-ops/start") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const productIds = Array.isArray(body.productIds)
        ? body.productIds
        : getEligibleAutoOpsProducts(db).map((item) => item.id);
      const result = startAutoOpsBatch(
        db,
        productIds,
        {
          template: body.template || "全自动运营",
          multiAccount: body.multiAccount,
          autoExecute: body.autoExecute,
        },
        getWorkflowHelpers(),
        { createWorkflowInstance, advanceWorkflow }
      );
      sendSavedState(res, db, `Auto-ops started for ${result.count} products`);
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/products") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const recognized = autoRecognizeFields(body);
      const product = { id: nextId(db.products, "P"), ...defaultProductFields(recognized, db) };
      applyStockSideEffects(db, product, product.stock);
      db.products.unshift(product);
      addLog(db, product.id, `创建商品「${product.name}」`);
      if (body.autoStart) {
        startAutoOpsBatch(
          db,
          [product.id],
          {
            template: body.autoTemplate || "全自动运营",
            multiAccount: body.multiAccount,
            autoExecute: body.autoExecute,
          },
          getWorkflowHelpers(),
          { createWorkflowInstance, advanceWorkflow }
        );
      }
      sendSavedState(res, db, body.autoStart ? "Product created and auto-ops started" : "Product created");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const productUpdateMatch = url.pathname.match(/^\/api\/actions\/products\/([^/]+)$/);
  if (req.method === "PATCH" && productUpdateMatch) {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const index = db.products.findIndex((item) => item.id === productUpdateMatch[1]);

      if (index < 0) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }

      const before = { ...db.products[index] };
      const patch = {};

      if (body.name !== undefined) patch.name = String(body.name).trim() || before.name;
      if (body.code !== undefined) patch.code = String(body.code).trim() || before.code;
      if (body.category !== undefined) patch.category = String(body.category).trim() || before.category;
      if (body.price !== undefined) patch.price = Number.isFinite(Number(body.price)) ? Number(body.price) : before.price;
      if (body.stock !== undefined) patch.stock = Number.isFinite(Number(body.stock)) ? Number(body.stock) : before.stock;
      if (body.warningStock !== undefined) {
        patch.warningStock = Number.isFinite(Number(body.warningStock)) ? Number(body.warningStock) : before.warningStock;
      }
      if (body.sellingPoints !== undefined) patch.sellingPoints = String(body.sellingPoints).trim();
      if (body.specs !== undefined) patch.specs = String(body.specs).trim();
      if (body.platforms !== undefined) patch.platforms = parseStringList(body.platforms);
      if (body.accounts !== undefined) patch.accounts = parseStringList(body.accounts);

      const previousStock = before.stock;
      db.products[index] = { ...before, ...patch, updatedAt: "刚刚" };
      applyStockSideEffects(db, db.products[index], previousStock);
      const changes = summarizeProductChanges(before, db.products[index]);
      addLog(db, db.products[index].id, changes.length ? `更新商品资料：${changes.join("、")}` : "更新商品资料");
      sendSavedState(res, db, "Product updated");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/inventory/sync") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const product = getProduct(db, body.productId);
      if (!product) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }
      const result = updateProductInventory(
        db,
        product.id,
        {
          stock: body.stock,
          warningStock: body.warningStock,
        },
        getPublishHelpers()
      );
      sendSavedState(res, db, result.resumed ? "Inventory restored, tasks resumed" : "Inventory synced");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/inventory/batch-import") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const rows = Array.isArray(body.items)
        ? body.items
        : body.csv
          ? parseInventoryCsv(body.csv)
          : [];
      const result = batchImportInventory(db, rows, getPublishHelpers());
      sendJson(res, 200, {
        ok: true,
        message: `Updated ${result.count} products`,
        data: writeDb(db),
        result,
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  return false;
}

function serveGenerated(req, res) {
  const prefix = "/generated/";
  if (!req.url.startsWith(prefix)) return false;

  const relative = decodeURIComponent(req.url.slice(prefix.length).split("?")[0]);
  const filePath = path.normalize(path.join(GENERATED_DIR, relative));
  if (!filePath.startsWith(GENERATED_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
  return true;
}

function serveStatic(req, res) {
  const filePath = safeStaticPath(req.url);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    const handled = await handleApi(req, res);
    if (!handled) sendJson(res, 404, { ok: false, error: "API not found" });
    return;
  }

  if (serveGenerated(req, res)) return;
  serveStatic(req, res);
});

server.listen(PORT, () => {
  resumePendingGenerationTasks();
  const db = readDb();
  db.workflowInstances
    .filter((item) => item.status === "执行中")
    .forEach((item) => advanceWorkflow(db, item.id, getWorkflowHelpers()));
  syncWorkflowSummaries(db);
  writeDb(db);
  console.log(`AI ecommerce ops MVP is running at http://localhost:${PORT}`);
});
