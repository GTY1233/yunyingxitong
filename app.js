const state = {
  view: "dashboard",
  activeGenerator: "image",
  selectedProductId: "P1001",
  selectedAssetId: "A002",
  selectedTaskId: "GT001",
  productFilter: "all",
  productFormOpen: false,
  productEditing: false,
  productDeskExpanded: false,
  inventoryEditingId: "",
  assetFormOpen: false,
  assetFilter: "all",
  assetEditing: false,
  workflowFilter: "active",
  workflowTemplate: "新品半自动",
  selectedWorkflowId: "",
  selectedPublishTaskId: "",
  publishFormOpen: false,
  accountFormOpen: false,
  platformCapabilities: [],
  analytics: null,
  productStrategy: null,
  strategySummary: null,
  templateAb: null,
  workflowNodeCatalog: [],
  customWorkflowTemplates: [],
  orchestratorSteps: [],
  orchestratorEditingId: "",
  copyProvider: "template",
  imageProvider: "template",
  videoProvider: "template",
};

let pollTimer = null;

const COPY_TYPE_OPTIONS = ["商品标题", "核心卖点", "详情文案", "视频脚本", "发布文案"];

const API_ENABLED = window.location.protocol !== "file:";

const CATEGORY_OPTIONS = ["家居日用", "数码配件", "旅行用品", "休闲食品", "服装配饰", "美妆护肤", "待识别"];
const PLATFORM_OPTIONS = ["抖音", "小红书", "淘宝", "拼多多", "视频号", "快手"];
const ASSET_KIND_OPTIONS = [
  ["image", "图片"],
  ["copy", "文案"],
  ["video", "视频"],
];
const ASSET_TYPE_BY_KIND = {
  image: ["主图", "详情页图", "卖点图", "封面图", "场景图"],
  copy: ["商品标题", "发布文案", "详情文案", "视频脚本", "核心卖点"],
  video: ["商品展示视频", "图文混剪视频", "商品讲解视频"],
};

let products = [
  {
    id: "P1001",
    name: "智能恒温杯",
    code: "SKU-CUP-001",
    category: "家居日用",
    price: 129,
    stock: 186,
    warningStock: 40,
    platforms: ["抖音", "小红书"],
    accounts: ["抖音内容号 A", "小红书种草号"],
    status: "待发布",
    imageStatus: "已生成",
    copyStatus: "已生成",
    videoStatus: "已生成",
    listingStatus: "草稿中",
    publishStatus: "待发布",
    progress: 68,
    updatedAt: "今天 15:20",
    colors: ["#ccfbf1", "#60a5fa"],
    sellingPoints: "恒温显示、长效保温、车载适配、礼盒包装",
    specs: "450ml / 白色、黑色 / USB 充电",
  },
  {
    id: "P1002",
    name: "折叠补光灯",
    code: "SKU-LIGHT-022",
    category: "数码配件",
    price: 89,
    stock: 28,
    warningStock: 35,
    platforms: ["抖音", "视频号"],
    accounts: ["测评号 B"],
    status: "库存预警",
    imageStatus: "已生成",
    copyStatus: "已生成",
    videoStatus: "未生成",
    listingStatus: "未上架",
    publishStatus: "未发布",
    progress: 42,
    updatedAt: "今天 14:06",
    colors: ["#fef3c7", "#38bdf8"],
    sellingPoints: "三档亮度、折叠收纳、直播拍摄、桌面补光",
    specs: "12W / 三色温 / Type-C",
  },
  {
    id: "P1003",
    name: "旅行压缩收纳包",
    code: "SKU-BAG-118",
    category: "旅行用品",
    price: 59,
    stock: 0,
    warningStock: 30,
    platforms: ["淘宝", "拼多多"],
    accounts: ["淘宝店铺", "拼多多店铺"],
    status: "已暂停",
    imageStatus: "已发布",
    copyStatus: "已发布",
    videoStatus: "已发布",
    listingStatus: "已上架",
    publishStatus: "已暂停",
    progress: 76,
    updatedAt: "今天 11:42",
    colors: ["#d9f99d", "#fb7185"],
    sellingPoints: "节省空间、防水分区、出差旅行、可视网格",
    specs: "三件套 / 灰色、湖蓝 / 牛津布",
  },
  {
    id: "P1004",
    name: "低糖燕麦能量棒",
    code: "SKU-FOOD-064",
    category: "休闲食品",
    price: 39,
    stock: 320,
    warningStock: 60,
    platforms: ["小红书", "抖音"],
    accounts: ["健康生活号", "促销号 C"],
    status: "生成中",
    imageStatus: "生成中",
    copyStatus: "已生成",
    videoStatus: "生成中",
    listingStatus: "草稿中",
    publishStatus: "未发布",
    progress: 54,
    updatedAt: "今天 10:18",
    colors: ["#fde68a", "#34d399"],
    sellingPoints: "低糖、高纤、代餐零食、独立包装",
    specs: "12 支装 / 海盐黑巧 / 常温保存",
  },
];

const DEFAULT_WORKFLOW_TEMPLATES = [
  { name: "新品半自动", steps: ["生成文案", "生成图片", "生成视频", "等待预览确认", "创建发布任务"], stepCount: 5 },
  { name: "快速发布", steps: ["生成文案", "生成图片", "等待预览确认", "创建发布任务"], stepCount: 4 },
  { name: "仅生成成品", steps: ["生成文案", "生成图片", "生成视频", "等待预览确认"], stepCount: 4 },
  { name: "全自动运营", steps: ["生成文案", "生成图片", "生成视频", "等待预览确认", "创建上架草稿", "矩阵创建发布", "自动上架", "自动发布"], stepCount: 8 },
];

let workflowInstances = [];

let workflowTemplates = DEFAULT_WORKFLOW_TEMPLATES;

let workflows = [
  { productId: "P1001", product: "智能恒温杯", node: "视频成品待发布", status: "待发布", progress: 68 },
  { productId: "P1004", product: "低糖燕麦能量棒", node: "正在生成视频", status: "生成中", progress: 54 },
  { productId: "P1002", product: "折叠补光灯", node: "库存低于预警值", status: "异常", progress: 42 },
  { productId: "P1003", product: "旅行压缩收纳包", node: "库存为 0，发布已暂停", status: "已暂停", progress: 76 },
];

let assets = [
  { id: "A001", productId: "P1001", name: "恒温杯主图 A", type: "主图", status: "已生成", usage: "成品库", version: "v3", kind: "image", source: "generated" },
  { id: "A002", productId: "P1001", name: "恒温杯种草视频", type: "短视频", status: "已生成", usage: "成品库", version: "v2", kind: "video", source: "generated" },
  { id: "A003", productId: "P1002", name: "补光灯详情页图", type: "详情页图", status: "已生成", usage: "成品库", version: "v1", kind: "image", source: "generated" },
  { id: "A004", productId: "P1003", name: "收纳包卖点图", type: "卖点图", status: "已发布", usage: "已发布", version: "v4", kind: "image", source: "generated" },
  { id: "A005", productId: "P1004", name: "燕麦棒发布文案", type: "发布文案", status: "已生成", usage: "成品库", version: "v1", kind: "copy", source: "generated", content: "低糖不寡淡，独立小包装更适合通勤、健身和办公室加餐。" },
];

let generationTasks = [
  { id: "GT001", productId: "P1004", productName: "低糖燕麦能量棒", kind: "video", type: "短视频", label: "AI 视频", status: "执行中", assetId: "", assetName: "", error: "", attempts: 1, maxAttempts: 3, createdAt: "14:50", updatedAt: "14:52", startedAt: "14:52", finishedAt: "" },
  { id: "GT002", productId: "P1001", productName: "智能恒温杯", kind: "image", type: "主图", label: "AI 图片", status: "已成功", assetId: "A001", assetName: "恒温杯主图 A", error: "", attempts: 1, maxAttempts: 3, createdAt: "15:10", updatedAt: "15:12", startedAt: "15:10", finishedAt: "15:12" },
  { id: "GT003", productId: "P1002", productName: "折叠补光灯", kind: "copy", type: "发布文案", label: "AI 文案", status: "失败", assetId: "", assetName: "", error: "生成服务暂时不可用", attempts: 2, maxAttempts: 3, createdAt: "13:40", updatedAt: "13:42", startedAt: "13:40", finishedAt: "13:42" },
];

let listingTasks = [
  { id: "L001", productId: "P1001", platform: "抖音", account: "抖店主账号", status: "草稿中", completeness: 86 },
  { id: "L002", productId: "P1004", platform: "小红书", account: "小红书店铺", status: "草稿中", completeness: 74 },
  { id: "L003", productId: "P1003", platform: "淘宝", account: "淘宝店铺", status: "已上架", completeness: 100 },
];

let publishTasks = [
  { id: "PUB001", productId: "P1001", assetId: "A002", assetName: "恒温杯种草视频", platform: "小红书", account: "小红书种草号", status: "待发布", time: "今天 18:30", attachProduct: true },
  { id: "PUB002", productId: "P1002", platform: "视频号", account: "测评号 B", status: "待素材", time: "明天 10:00", attachProduct: false },
  { id: "PUB003", productId: "P1003", platform: "抖音", account: "促销号 C", status: "已暂停", time: "库存恢复后", attachProduct: true },
];

let accounts = [
  { id: "AC001", platform: "抖音", name: "抖店主账号", type: "店铺账号", auth: "已授权", rule: "上架前必须审核", persona: "商品管理" },
  { id: "AC002", platform: "抖音", name: "抖音内容号 A", type: "内容账号", auth: "已授权", rule: "每天最多 3 条", persona: "种草展示" },
  { id: "AC003", platform: "小红书", name: "小红书种草号", type: "内容账号", auth: "已授权", rule: "每天最多 2 条", persona: "生活方式种草" },
  { id: "AC004", platform: "视频号", name: "测评号 B", type: "内容账号", auth: "授权即将过期", rule: "失败后重试 1 条", persona: "测评讲解" },
];

let platformFailures = [];

let logs = [
  { productId: "P1001", text: "[生成] AI 图片生成完成，新增 4 个主图版本", time: "15:20", action: "generation" },
  { productId: "P1001", text: "[生成] 发布文案 6 版已保存到成品库", time: "15:08", action: "generation" },
  { productId: "P1004", text: "[生成] 视频生成任务执行中", time: "14:55", action: "generation" },
  { productId: "P1003", text: "库存为 0，系统暂停 3 个待发布任务", time: "11:42", action: "general" },
];

const titles = {
  dashboard: "待办收件箱",
  products: "商品运营台",
  generator: "AI 生成工作台",
  tasks: "生成任务",
  publish: "发布中心",
  assets: "全量成品库",
  accounts: "平台账号",
  inventory: "库存中心",
  data: "数据中心",
  workflows: "自动化流程",
};

const GENERATION_KIND_LABEL = { image: "图片", copy: "文案", video: "视频" };
const ACTIVE_TASK_STATUSES = ["待执行", "执行中"];

const root = document.querySelector("#viewRoot");
const pageTitle = document.querySelector("#pageTitle");
const topActions = document.querySelector("#topActions");
const toast = document.querySelector("#toast");

function getDataState() {
  return { products, workflows, workflowInstances, assets, generationTasks, listingTasks, publishTasks, accounts, platformFailures, logs };
}

function applyDataState(data) {
  products = Array.isArray(data.products) ? data.products : products;
  workflows = Array.isArray(data.workflows) ? data.workflows : workflows;
  workflowInstances = Array.isArray(data.workflowInstances) ? data.workflowInstances : workflowInstances;
  assets = Array.isArray(data.assets) ? data.assets : assets;
  generationTasks = Array.isArray(data.generationTasks) ? data.generationTasks : generationTasks;
  listingTasks = Array.isArray(data.listingTasks) ? data.listingTasks : listingTasks;
  publishTasks = Array.isArray(data.publishTasks) ? data.publishTasks : publishTasks;
  accounts = Array.isArray(data.accounts) ? data.accounts : accounts;
  platformFailures = Array.isArray(data.platformFailures) ? data.platformFailures : platformFailures;
  logs = Array.isArray(data.logs) ? data.logs : logs;

  if (!productById(state.selectedProductId)) {
    state.selectedProductId = products[0]?.id || "";
  }
  if (!assetById(state.selectedAssetId)) {
    state.selectedAssetId = assets[0]?.id || "";
  }
  if (!taskById(state.selectedTaskId)) {
    state.selectedTaskId = generationTasks[0]?.id || "";
  }
  syncTaskPolling();
}

async function loadRemoteState(options = {}) {
  if (!API_ENABLED) return;
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load state");
    const data = await response.json();
    if (Array.isArray(data.products) && data.products.length > 0) {
      applyDataState(data);
      return;
    }
    await persistState();
  } catch (error) {
    if (!options.silent) showToast("未连接本地数据服务，当前使用静态演示数据。");
  }
}

async function loadAnalytics() {
  if (!API_ENABLED) {
    state.analytics = buildLocalAnalytics();
    return;
  }
  try {
    const response = await fetch("/api/analytics/summary", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    const data = await response.json();
    state.analytics = data.analytics || buildLocalAnalytics();
  } catch (error) {
    state.analytics = buildLocalAnalytics();
  }
}

async function loadProductStrategy(productId) {
  if (!API_ENABLED) {
    state.productStrategy = buildLocalProductStrategy(productId);
    return;
  }
  try {
    const response = await fetch(`/api/strategy/product/${productId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    const data = await response.json();
    state.productStrategy = data.strategy || buildLocalProductStrategy(productId);
  } catch (error) {
    state.productStrategy = buildLocalProductStrategy(productId);
  }
}

async function loadStrategySummary() {
  if (!API_ENABLED) {
    state.strategySummary = null;
    return;
  }
  try {
    const response = await fetch("/api/strategy/summary", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    const data = await response.json();
    state.strategySummary = data.strategy || null;
  } catch (error) {
    state.strategySummary = null;
  }
}

function buildLocalProductStrategy(productId) {
  const product = productById(productId);
  if (!product) return null;
  const productAssets = getProductAssets(productId).filter((item) => item.status === "已生成");
  const recommendedAsset = productAssets[0]
    ? { assetId: productAssets[0].id, name: productAssets[0].name, kind: productAssets[0].kind, score: 50, reason: "本地演示推荐" }
    : null;
  const accountMatches = accounts
    .filter((item) => item.type === "内容账号")
    .slice(0, 3)
    .map((item, index) => ({
      accountId: item.id,
      name: item.name,
      platform: item.platform,
      persona: item.persona,
      score: 70 - index * 8,
      reason: `人设「${item.persona}」`,
      suggestedAngle: "突出商品核心卖点。",
    }));
  return {
    productId,
    productName: product.name,
    recommendedAsset,
    recommendedTemplate: { name: countMissingMaterials(product) ? "新品半自动" : "快速发布", reason: "基于素材状态推荐" },
    accountMatches,
    copyPlans: accountMatches.map((item, index) => ({
      accountId: item.accountId,
      accountName: item.name,
      platform: item.platform,
      persona: item.persona,
      extraPrompt: `${item.suggestedAngle} 差异化版本 ${index + 1}。`,
      copyType: "发布文案",
    })),
    hints: ["连接本地服务后可获得完整策略推荐。"],
  };
}

function buildLocalAnalytics() {
  const gen = (kind) => {
    const list = generationTasks.filter((item) => item.kind === kind);
    const success = list.filter((item) => item.status === "已成功").length;
    const finished = list.filter((item) => ["已成功", "失败"].includes(item.status)).length;
    return { kind, total: list.length, success, successRate: finished ? Math.round((success / finished) * 100) : 0 };
  };
  const pubOk = publishTasks.filter((item) => item.status === "已成功").length;
  const pubDone = publishTasks.filter((item) => ["已成功", "失败"].includes(item.status)).length;
  return {
    automation: {
      generation: [gen("image"), gen("copy"), gen("video")],
      publishSuccessRate: pubDone ? Math.round((pubOk / pubDone) * 100) : 0,
      listingSuccessRate: 0,
      workflowSuccessRate: 0,
      assetPublishConversion: 0,
    },
    products: products.map((p) => ({ productId: p.id, name: p.name, score: p.progress || 0 })),
    assets: [],
    accounts: [],
    hints: ["连接本地服务后可查看完整数据分析。"],
  };
}

function renderBarChartRows(rows) {
  return rows
    .map(
      ([label, value, color]) =>
        `<div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar"><span style="--value:${Math.min(100, value)}%;--color:${color}"></span></div><strong>${value}%</strong></div>`
    )
    .join("");
}

function renderDataTable(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

async function loadPlatformCapabilities() {
  if (!API_ENABLED) {
    state.platformCapabilities = [
      { platform: "抖音", summary: ["导出发布", "半自动发布", "自动发布"], hasLiveApi: false },
      { platform: "小红书", summary: ["导出发布", "半自动发布", "自动发布"], hasLiveApi: false },
      { platform: "淘宝", summary: ["导出发布", "半自动发布", "自动上架"], hasLiveApi: false },
      { platform: "拼多多", summary: ["导出发布", "半自动发布", "自动上架"], hasLiveApi: false },
    ];
    return;
  }
  try {
    const response = await fetch("/api/platforms/capabilities", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    const data = await response.json();
    state.platformCapabilities = Array.isArray(data.platforms) ? data.platforms : [];
  } catch (error) {
    state.platformCapabilities = [];
  }
}

async function loadWorkflowTemplates() {
  if (!API_ENABLED) {
    workflowTemplates = DEFAULT_WORKFLOW_TEMPLATES;
    return;
  }
  try {
    const response = await fetch("/api/workflows/templates", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load templates");
    const data = await response.json();
    if (Array.isArray(data.templates) && data.templates.length) {
      workflowTemplates = data.templates;
    }
  } catch (error) {
    workflowTemplates = DEFAULT_WORKFLOW_TEMPLATES;
  }
}

async function loadWorkflowOrchestratorData() {
  if (!API_ENABLED) {
    state.workflowNodeCatalog = [
      { key: "generate_copy", label: "生成文案", category: "生成" },
      { key: "generate_image", label: "生成图片", category: "生成" },
      { key: "generate_video", label: "生成视频", category: "生成" },
      { key: "wait_confirm", label: "等待预览确认", category: "人工" },
      { key: "create_publish", label: "创建发布任务", category: "发布" },
    ];
    state.customWorkflowTemplates = [];
    return;
  }
  try {
    const [nodesRes, customRes] = await Promise.all([
      fetch("/api/workflows/node-catalog", { cache: "no-store" }),
      fetch("/api/workflows/custom-templates", { cache: "no-store" }),
    ]);
    if (nodesRes.ok) {
      const nodesData = await nodesRes.json();
      state.workflowNodeCatalog = nodesData.nodes || [];
    }
    if (customRes.ok) {
      const customData = await customRes.json();
      state.customWorkflowTemplates = customData.templates || [];
    }
  } catch (error) {
    state.workflowNodeCatalog = [];
    state.customWorkflowTemplates = [];
  }
}

async function loadTemplateAb() {
  if (!API_ENABLED) {
    state.templateAb = null;
    return;
  }
  try {
    const response = await fetch("/api/analytics/template-ab", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    const data = await response.json();
    state.templateAb = data.templateAb || null;
  } catch (error) {
    state.templateAb = null;
  }
}

async function saveCustomWorkflowFromForm() {
  const form = document.querySelector("#orchestratorForm");
  if (!form) return false;
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  if (!name) {
    showToast("请填写模板名称。");
    return false;
  }
  if (!state.orchestratorSteps.length) {
    showToast("请至少添加一个流程节点。");
    return false;
  }
  if (!API_ENABLED) {
    showToast("请连接本地服务后保存自定义流程。");
    return false;
  }
  try {
    const response = await fetch("/api/workflows/custom-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: state.orchestratorEditingId || undefined,
        name,
        description: String(data.get("description") || "").trim(),
        steps: state.orchestratorSteps.map((item) => ({ key: item.key })),
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Save failed");
    showToast(`自定义流程「${name}」已保存。`);
    state.orchestratorEditingId = result.template?.id || "";
    await Promise.all([loadWorkflowOrchestratorData(), loadWorkflowTemplates()]);
    return true;
  } catch (error) {
    showToast(error.message || "保存失败。");
    return false;
  }
}

async function persistState() {
  if (!API_ENABLED) return;
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getDataState()),
    });
  } catch (error) {
    showToast("数据保存失败，请确认本地服务仍在运行。");
  }
}

async function runApiAction(path, payload) {
  if (!API_ENABLED) return false;
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "API action failed");
    if (result.data) applyDataState(result.data);
    return true;
  } catch (error) {
    showToast("接口调用失败，已保留当前页面状态。");
    return false;
  }
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listToInput(list) {
  return Array.isArray(list) ? list.join("、") : "";
}

function inputToList(value) {
  return String(value || "")
    .split(/[,、，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function productById(id) {
  return products.find((item) => item.id === id) || products[0];
}

function assetById(id) {
  return assets.find((item) => item.id === id);
}

function taskById(id) {
  return generationTasks.find((item) => item.id === id);
}

function hasActiveGenerationTasks() {
  return generationTasks.some((item) => ACTIVE_TASK_STATUSES.includes(item.status));
}

function hasActiveWorkflows() {
  return workflowInstances.some((item) => ["执行中", "等待确认"].includes(item.status));
}

function syncTaskPolling() {
  if (!API_ENABLED) return;
  if (hasActiveGenerationTasks() || hasActiveWorkflows()) startTaskPolling();
  else stopTaskPolling();
}

function startTaskPolling() {
  if (pollTimer) return;
  pollTimer = window.setInterval(async () => {
    await loadRemoteState({ silent: true });
    render();
    if (!hasActiveGenerationTasks() && !hasActiveWorkflows()) stopTaskPolling();
  }, 2000);
}

function stopTaskPolling() {
  if (!pollTimer) return;
  window.clearInterval(pollTimer);
  pollTimer = null;
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

function materialNeedsGeneration(status) {
  return ["未生成", "待生成", "生成失败"].includes(status);
}

function defaultGenerationParams(kind, product) {
  const account = getDefaultContentAccount(product);
  if (kind === "copy") {
    return {
      copyType: "发布文案",
      platform: account?.platform || product.platforms[0] || "抖音",
      versionCount: 3,
      extraPrompt: "不要夸大宣传，强调使用场景和购买理由。",
      accountId: account?.id || "",
      accountName: account?.name || "",
    };
  }
  if (kind === "image") {
    return {
      imageType: "商品主图",
      imageSize: "1:1 平台主图",
      imageCount: 4,
      extraPrompt: "真实商品质感，干净背景，突出核心卖点。",
    };
  }
  return {
    videoType: "商品展示视频",
    videoRatio: "9:16 竖版",
    videoDuration: "15 秒",
    extraPrompt: "",
  };
}

function accountById(id) {
  return accounts.find((item) => item.id === id);
}

function accountByName(name) {
  return accounts.find((item) => item.name === name);
}

function getProductContentAccounts(product) {
  const names = new Set(product.accounts || []);
  return accounts.filter((item) => names.has(item.name) && item.type === "内容账号");
}

function getDefaultContentAccount(product) {
  return getProductContentAccounts(product)[0] || accountByName(product.accounts?.[0]) || accounts.find((item) => item.type === "内容账号");
}

function publishTasksBySlot(slot) {
  return publishTasks.filter((item) => (item.scheduleSlot || inferPublishSlot(item.time)) === slot);
}

function inferPublishSlot(time) {
  const text = String(time || "");
  if (text.includes("明天")) return "明天";
  if (text.includes("本周") || text.includes("恢复")) return "本周";
  return "今天";
}

function renderAccountOptions(product, selectedId = "") {
  const list = getProductContentAccounts(product);
  const fallback = list.length ? list : accounts.filter((item) => item.type === "内容账号");
  return fallback
    .map(
      (item) =>
        `<option value="${item.id}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}（${escapeHtml(item.platform)} / ${escapeHtml(item.persona)}）</option>`
    )
    .join("");
}

function renderPublishTaskRow(task, detailed = false) {
  const product = productById(task.productId);
  const failed = task.status === "失败";
  const canExecute = ["待发布", "失败"].includes(task.status);
  const canRetry = failed && (task.attempts || 0) < (task.maxAttempts || 2);
  return `<article class="task-item publish-row ${state.selectedPublishTaskId === task.id ? "selected" : ""}"><div><div class="task-title">${escapeHtml(product.name)} / ${escapeHtml(task.platform)}</div><div class="meta">${task.assetName ? `${escapeHtml(task.assetName)} / ` : ""}${escapeHtml(task.account)} / ${escapeHtml(task.time)} / ${task.mode || "半自动"}</div>${failed && task.failureReason ? `<div class="meta task-error">${escapeHtml(task.failureReason)}</div>` : ""}</div><div class="inline-actions">${statusPill(task.status)}${detailed ? `<button class="small-btn" type="button" data-action="select-publish-task" data-id="${task.id}">详情</button>` : ""}${canExecute ? `<button class="small-btn primary-inline" type="button" data-action="execute-publish" data-id="${task.id}">半自动发布</button>` : ""}${canRetry ? `<button class="small-btn" type="button" data-action="retry-publish" data-id="${task.id}">重试</button>` : ""}<button class="small-btn" type="button" data-action="export-task" data-id="${task.id}">导出</button></div></article>`;
}

async function downloadPublishExport(taskId) {
  const response = await fetch(`/api/actions/publish-tasks/${encodeURIComponent(taskId)}/export`, { cache: "no-store" });
  if (!response.ok) throw new Error("export failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${taskId}-publish.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function mountPublishModal() {
  let modal = document.querySelector("#publishModal");
  if (!state.publishFormOpen) {
    if (modal) modal.remove();
    return;
  }
  const product = productById(state.selectedProductId);
  const defaultAccount = getDefaultContentAccount(product);
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "publishModal";
    modal.className = "modal-backdrop";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-card"><div class="panel-header"><div><h2>创建发布任务</h2><p>选择内容账号与排期；库存为 0 时会拦截。</p></div><button class="ghost-btn" type="button" data-action="close-publish-form">关闭</button></div><form id="publishTaskForm" class="form-grid"><label class="field"><span>商品</span><select name="productId">${products.map((item) => `<option value="${item.id}" ${item.id === product.id ? "selected" : ""}>${escapeHtml(item.name)}（库存 ${item.stock}）</option>`).join("")}</select></label><label class="field"><span>内容账号</span><select name="accountId">${renderAccountOptions(product, defaultAccount?.id || "")}</select></label><label class="field"><span>发布模式</span><select name="mode"><option value="半自动">半自动发布</option><option value="自动">自动发布（需平台 OpenAPI）</option></select></label><label class="field"><span>排期</span><select name="scheduleSlot"><option value="今天">今天</option><option value="明天">明天</option><option value="本周">本周</option></select></label><label class="field"><span>时间</span><input name="scheduleTime" value="18:00" /></label><label class="field field-wide"><span>关联成品（可选）</span><select name="assetId"><option value="">不指定，发布时再选</option>${getProductAssets(product.id).filter((item) => item.status === "已生成").map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select></label><label class="field field-wide"><span><input type="checkbox" name="forceLowStock" value="1" /> 库存低于预警仍继续排期</span></label></form><div class="button-row"><button class="primary-btn" type="button" data-action="submit-publish-form">创建任务</button></div></div>`;
}

function mountAccountModal() {
  let modal = document.querySelector("#accountModal");
  if (!state.accountFormOpen) {
    if (modal) modal.remove();
    return;
  }
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "accountModal";
    modal.className = "modal-backdrop";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-card"><div class="panel-header"><div><h2>绑定平台账号</h2><p>店铺账号负责上架，内容账号负责发布；人设会影响文案生成。</p></div><button class="ghost-btn" type="button" data-action="close-account-form">关闭</button></div><form id="accountForm" class="form-grid"><label class="field"><span>账号名称</span><input name="name" required placeholder="例如：抖音测评号 C" /></label><label class="field"><span>平台</span><select name="platform">${PLATFORM_OPTIONS.map((item) => `<option value="${item}">${item}</option>`).join("")}</select></label><label class="field"><span>账号类型</span><select name="type"><option value="内容账号">内容账号</option><option value="店铺账号">店铺账号</option></select></label><label class="field"><span>授权状态</span><select name="auth"><option value="已授权">已授权</option><option value="授权即将过期">授权即将过期</option><option value="未授权">未授权</option></select></label><label class="field field-wide"><span>账号人设</span><input name="persona" value="种草展示" /></label><label class="field field-wide"><span>发布规则</span><input name="rule" value="每天最多 3 条" /></label></form><div class="button-row"><button class="primary-btn" type="button" data-action="submit-account-form">保存账号</button></div></div>`;
}

function getProductWorkflowInstance(productId) {
  return workflowInstances.find(
    (item) => item.productId === productId && ["执行中", "等待确认", "失败"].includes(item.status)
  );
}

function workflowById(id) {
  return workflowInstances.find((item) => item.id === id);
}

function computeWorkflowProgress(wf) {
  const done = wf.nodes.filter((node) => node.status === "已成功" || node.status === "已跳过").length;
  return Math.round((done / wf.nodes.length) * 100);
}

function getEligibleAutoOpsProducts() {
  return products.filter((product) => {
    if (product.stock === 0 || product.status === "已暂停") return false;
    if (getProductWorkflowInstance(product.id)) return false;
    return true;
  });
}

function getEligibleBatchProducts() {
  return products.filter((product) => {
    if (product.status === "已暂停" || product.publishStatus === "已发布") return false;
    if (getProductWorkflowInstance(product.id)) return false;
    return countMissingMaterials(product) > 0 || ["待发布", "生成中"].includes(product.status);
  });
}

function filterWorkflowInstances() {
  const filter = state.workflowFilter || "active";
  if (filter === "active") {
    return workflowInstances.filter((item) => ["执行中", "等待确认", "失败"].includes(item.status));
  }
  if (filter === "failed") return workflowInstances.filter((item) => item.status === "失败");
  if (filter === "done") return workflowInstances.filter((item) => ["已成功", "已取消"].includes(item.status));
  return workflowInstances;
}

function renderWorkflowTemplateOptions(selected = state.workflowTemplate) {
  return workflowTemplates
    .map(
      (item) =>
        `<option value="${escapeHtml(item.name)}" ${item.name === selected ? "selected" : ""}>${escapeHtml(item.name)}${item.custom ? " · 自定义" : ""}（${item.stepCount} 步）</option>`
    )
    .join("");
}

function renderOrchestratorStepRows() {
  if (!state.orchestratorSteps.length) {
    return `<p class="meta">从下方节点库添加步骤，组成自定义流程。</p>`;
  }
  return `<ol class="orchestrator-steps">${state.orchestratorSteps
    .map(
      (step, index) =>
        `<li class="orchestrator-step"><span>${index + 1}. ${escapeHtml(step.label)}</span><div class="inline-actions compact-actions"><button class="ghost-btn small-btn" type="button" data-action="move-orchestrator-step" data-index="${index}" data-dir="up" ${index === 0 ? "disabled" : ""}>↑</button><button class="ghost-btn small-btn" type="button" data-action="move-orchestrator-step" data-index="${index}" data-dir="down" ${index === state.orchestratorSteps.length - 1 ? "disabled" : ""}>↓</button><button class="ghost-btn small-btn" type="button" data-action="remove-orchestrator-step" data-index="${index}">移除</button></div></li>`
    )
    .join("")}</ol>`;
}

function renderWorkflowOrchestratorPanel() {
  const catalog = state.workflowNodeCatalog || [];
  const categories = [...new Set(catalog.map((item) => item.category))];
  const nodeChips = categories
    .map((category) => {
      const nodes = catalog.filter((item) => item.category === category);
      return `<div class="orchestrator-category"><span class="meta">${escapeHtml(category)}</span><div class="filter-row">${nodes
        .map(
          (node) =>
            `<button class="chip-btn" type="button" data-action="add-orchestrator-node" data-key="${node.key}">+ ${escapeHtml(node.label)}</button>`
        )
        .join("")}</div></div>`;
    })
    .join("");
  const saved = (state.customWorkflowTemplates || [])
    .map(
      (item) =>
        `<article class="orchestrator-saved"><div><strong>${escapeHtml(item.name)}</strong><p class="meta">${escapeHtml(item.description || "无描述")} · ${item.steps.length} 步</p><p class="meta">${item.steps.map((step) => step.label).join(" → ")}</p></div><div class="inline-actions compact-actions"><button class="ghost-btn small-btn" type="button" data-action="load-custom-workflow" data-id="${item.id}">编辑</button><button class="ghost-btn small-btn" type="button" data-action="use-custom-workflow" data-name="${escapeHtml(item.name)}">选用</button><button class="ghost-btn small-btn" type="button" data-action="delete-custom-workflow" data-id="${item.id}">删除</button></div></article>`
    )
    .join("");
  const editing = state.customWorkflowTemplates.find((item) => item.id === state.orchestratorEditingId);
  return `<section class="panel orchestrator-panel"><div class="panel-header"><div><h2>流程编排器</h2><p>从节点库组合自定义流程，保存后可在批量启动与商品运营台使用。</p></div><button class="ghost-btn" type="button" data-action="reset-orchestrator">新建模板</button></div><div class="orchestrator-layout"><div class="orchestrator-editor"><form id="orchestratorForm"><label class="field"><span>模板名称</span><input name="name" required value="${escapeHtml(editing?.name || "")}" placeholder="例如：图文快发 + 矩阵发布" /></label><label class="field field-wide"><span>描述（可选）</span><input name="description" value="${escapeHtml(editing?.description || "")}" placeholder="适用场景说明" /></label></form><h3 class="section-subtitle">当前步骤</h3>${renderOrchestratorStepRows()}<div class="button-row" style="margin-top:12px"><button class="primary-btn" type="button" data-action="save-custom-workflow">保存自定义流程</button></div></div><div class="orchestrator-side"><h3 class="section-subtitle">节点库</h3>${nodeChips || "<p class='meta'>加载节点库中…</p>"}<h3 class="section-subtitle" style="margin-top:18px">已保存模板</h3><div class="list orchestrator-saved-list">${saved || "<p class='meta'>还没有自定义流程。</p>"}</div></div></div></section>`;
}

function renderWorkflowNodes(wf) {
  return `<div class="workflow-nodes">${wf.nodes
    .map(
      (node) =>
        `<div class="workflow-node ${node.status === "已成功" || node.status === "已跳过" ? "done" : node.status === "等待确认" || node.status === "执行中" ? "active" : node.status === "失败" ? "failed" : ""}"><div><strong>${escapeHtml(node.label)}</strong>${node.error ? `<div class="meta task-error">${escapeHtml(node.error)}</div>` : ""}</div>${statusPill(node.status)}</div>`
    )
    .join("")}</div>`;
}

function renderWorkflowActions(wf, compact = false) {
  const active = wf.nodes.find((node) => !["已成功", "已跳过"].includes(node.status));
  const confirmDisabled = wf.status !== "等待确认" ? "disabled" : "";
  const retryDisabled = wf.status !== "失败" ? "disabled" : "";
  const cancelDisabled = ["已成功", "已取消"].includes(wf.status) ? "disabled" : "";
  const btnClass = compact ? "small-btn" : "ghost-btn";
  return `<div class="button-row ${compact ? "compact-actions" : ""}" style="margin-top:12px"><button class="primary-btn ${compact ? "small-btn" : ""}" type="button" data-action="confirm-workflow" data-id="${wf.id}" ${confirmDisabled}>已预览，继续</button><button class="${btnClass}" type="button" data-action="retry-workflow" data-id="${wf.id}" ${retryDisabled}>重试</button><button class="${btnClass}" type="button" data-action="skip-workflow" data-id="${wf.id}" ${active ? "" : "disabled"}>跳过</button><button class="${btnClass}" type="button" data-action="cancel-workflow" data-id="${wf.id}" ${cancelDisabled}>取消流程</button></div>`;
}

function computeLocalListingCompleteness(product) {
  const productAssets = getProductAssets(product.id);
  const checks = [
    Boolean(product.name),
    product.category && product.category !== "待识别",
    Number(product.price) > 0,
    Number(product.stock) > 0,
    Boolean(product.sellingPoints) && !String(product.sellingPoints).includes("待补充"),
    productAssets.some((item) => item.kind === "image") || product.imageStatus === "已生成",
    productAssets.some((item) => item.kind === "copy") || product.copyStatus === "已生成",
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

async function downloadExportPack(productId) {
  const product = productById(productId);
  if (API_ENABLED) {
    const response = await fetch(`/api/actions/export-pack?productId=${encodeURIComponent(productId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("export failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${product.code || productId}-export.json`;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const assetsForProduct = getProductAssets(productId);
  const pack = {
    exportedAt: new Date().toISOString(),
    product,
    materials: assetsForProduct,
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${product.code || productId}-export.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function openProductDesk(productId, options = {}) {
  state.selectedProductId = productId;
  if (options.assetId) state.selectedAssetId = options.assetId;
  if (options.taskId) state.selectedTaskId = options.taskId;
  if (options.workflowId) state.selectedWorkflowId = options.workflowId;
  setView("products");
}

function getProductAssets(productId) {
  return assets.filter((item) => item.productId === productId);
}

function getProductTasks(productId) {
  return generationTasks.filter((item) => item.productId === productId);
}

function getProductPublishTasks(productId) {
  return publishTasks.filter((item) => item.productId === productId);
}

function getProductListingTasks(productId) {
  return listingTasks.filter((item) => item.productId === productId);
}

function countMissingMaterials(product) {
  return [product.imageStatus, product.copyStatus, product.videoStatus].filter(materialNeedsGeneration).length;
}

function buildInboxItems() {
  const items = [];
  assets
    .filter((item) => item.status === "已生成")
    .forEach((asset) => {
      const product = productById(asset.productId);
      items.push({
        id: `inbox-asset-${asset.id}`,
        tone: "primary",
        title: `${product.name}：${asset.name}`,
        meta: `${asset.type} 待确认发布`,
        action: "open-product-desk",
        productId: asset.productId,
        assetId: asset.id,
        cta: "预览并发布",
      });
    });
  generationTasks
    .filter((item) => item.status === "失败")
    .forEach((task) => {
      items.push({
        id: `inbox-fail-${task.id}`,
        tone: "danger",
        title: `${task.productName}：${GENERATION_KIND_LABEL[task.kind] || task.kind}生成失败`,
        meta: task.error || task.type,
        action: "open-product-desk",
        productId: task.productId,
        taskId: task.id,
        cta: "去重试",
      });
    });
  products.forEach((product) => {
    const missing = countMissingMaterials(product);
    if (missing > 0 && product.status !== "已暂停") {
      items.push({
        id: `inbox-missing-${product.id}`,
        tone: "warn",
        title: `${product.name}：还缺 ${missing} 类素材`,
        meta: "可一键补全主图、文案、视频",
        action: "fill-missing-materials",
        productId: product.id,
        cta: "一键补全",
      });
    }
    if (product.stock <= product.warningStock) {
      items.push({
        id: `inbox-stock-${product.id}`,
        tone: product.stock === 0 ? "danger" : "warn",
        title: `${product.name}：${product.stock === 0 ? "库存售罄" : "库存预警"}`,
        meta: `当前 ${product.stock} / 预警 ${product.warningStock}`,
        action: "open-product-desk",
        productId: product.id,
        cta: "查看商品",
      });
    }
  });
  generationTasks
    .filter((item) => ACTIVE_TASK_STATUSES.includes(item.status))
    .slice(0, 6)
    .forEach((task) => {
      items.push({
        id: `inbox-run-${task.id}`,
        tone: "info",
        title: `${task.productName}：${GENERATION_KIND_LABEL[task.kind] || task.kind}生成中`,
        meta: `${task.type} / ${task.updatedAt}`,
        action: "open-product-desk",
        productId: task.productId,
        taskId: task.id,
        cta: "查看进度",
      });
    });
  workflowInstances
    .filter((item) => item.status === "等待确认")
    .forEach((wf) => {
      items.push({
        id: `inbox-wf-${wf.id}`,
        tone: "primary",
        title: `${wf.productName}：半自动流程等待预览确认`,
        meta: wf.id,
        action: "open-product-desk",
        productId: wf.productId,
        workflowId: wf.id,
        cta: "去确认",
      });
    });
  workflowInstances
    .filter((item) => item.status === "失败")
    .forEach((wf) => {
      items.push({
        id: `inbox-wf-fail-${wf.id}`,
        tone: "danger",
        title: `${wf.productName}：自动化流程失败`,
        meta: wf.nodes.find((node) => node.status === "失败")?.error || wf.id,
        action: "open-workflows",
        productId: wf.productId,
        workflowId: wf.id,
        cta: "异常队列",
      });
    });
  publishTasks
    .filter((item) => item.status === "失败")
    .forEach((task) => {
      const product = productById(task.productId);
      items.push({
        id: `inbox-pub-fail-${task.id}`,
        tone: "danger",
        title: `${product.name}：发布失败`,
        meta: task.failureReason || `${task.account} / ${task.platform}`,
        action: "open-publish-failures",
        productId: task.productId,
        taskId: task.id,
        cta: "去处理",
      });
    });
  listingTasks
    .filter((item) => item.status === "失败")
    .forEach((task) => {
      const product = productById(task.productId);
      items.push({
        id: `inbox-listing-fail-${task.id}`,
        tone: "danger",
        title: `${product.name}：上架失败`,
        meta: task.failureReason || `${task.platform}`,
        action: "go",
        productId: task.productId,
        view: "publish",
        cta: "去处理",
      });
    });
  platformFailures
    .filter((item) => item.status === "待处理")
    .slice(0, 5)
    .forEach((item) => {
      const product = productById(item.productId);
      items.push({
        id: `inbox-pf-${item.id}`,
        tone: "danger",
        title: `${product.name}：${item.platform} 平台异常`,
        meta: item.reason,
        action: "go",
        productId: item.productId,
        view: "publish",
        cta: "查看",
      });
    });
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function renderProgressSteps(product) {
  const productAssets = getProductAssets(product.id);
  const hasReadyAsset = productAssets.some((item) => item.status === "已生成");
  const generating = [product.imageStatus, product.copyStatus, product.videoStatus].includes("生成中");
  const materialsReady = !countMissingMaterials(product);
  const hasPublish = getProductPublishTasks(product.id).length > 0 || product.publishStatus === "已发布";
  const steps = [
    { label: "商品资料", done: Boolean(product.name && product.sellingPoints) },
    { label: "AI 生成", done: materialsReady && !generating, active: generating },
    { label: "预览确认", done: hasReadyAsset, active: !generating && hasReadyAsset && product.status === "待发布" },
    { label: "发布导出", done: hasPublish, active: hasReadyAsset && !hasPublish },
  ];
  return `<div class="progress-steps">${steps
    .map(
      (step) =>
        `<div class="progress-step ${step.done ? "done" : step.active ? "active" : ""}"><span class="step-dot"></span><span>${step.label}</span></div>`
    )
    .join("")}</div>`;
}

function renderMaterialChecklist(product) {
  const rows = [
    { kind: "image", label: "主图", status: product.imageStatus },
    { kind: "copy", label: "文案", status: product.copyStatus },
    { kind: "video", label: "视频", status: product.videoStatus },
  ];
  return `<div class="material-checklist">${rows
    .map(
      (row) => `<div class="material-row"><div><strong>${row.label}</strong><div class="meta">${row.status}</div></div><div class="inline-actions">${statusPill(row.status)}${
        materialNeedsGeneration(row.status)
          ? `<button class="small-btn" type="button" data-action="quick-generate" data-kind="${row.kind}" data-product="${product.id}">生成</button>`
          : ""
      }</div></div>`
    )
    .join("")}</div>`;
}

function renderProductPicker() {
  return `<div class="product-picker">${products
    .map(
      (item) =>
        `<button type="button" class="chip-btn ${item.id === state.selectedProductId ? "active" : ""}" data-action="select-product" data-id="${item.id}">${escapeHtml(item.name)}</button>`
    )
    .join("")}</div>`;
}

function renderInlineGenerator(product) {
  const missing = countMissingMaterials(product);
  return `<div class="panel desk-panel"><div class="panel-header"><div><h3>生成素材</h3><p>在当前商品上直接生成，无需跳转。</p></div>${
    missing
      ? `<button class="ghost-btn" type="button" data-action="fill-missing-materials" data-product="${product.id}">一键补全 ${missing} 项</button>`
      : ""
  }</div>${renderMaterialChecklist(product)}<div class="tabs">${[["image", "图片"], ["copy", "文案"], ["video", "视频"]]
    .map(
      ([key, label]) =>
        `<button type="button" class="tab-btn ${state.activeGenerator === key ? "active" : ""}" data-action="generator-tab" data-tab="${key}">${label}</button>`
    )
    .join("")}</div><form id="generatorForm" class="form-grid compact-form" data-action="stop-propagation">${renderGeneratorFields()}</form><div class="button-row"><button class="primary-btn" type="button" data-action="run-generator">开始生成</button></div><div class="list desk-task-list">${getProductTasks(product.id)
    .slice(0, 5)
    .map(renderGenerationTaskRow)
    .join("") || "<p class='meta'>暂无本商品生成任务。</p>"}</div></div>`;
}

function renderDeskAssetPanel(product) {
  const productAssets = getProductAssets(product.id);
  const selected = assetById(state.selectedAssetId);
  const activeAsset = selected?.productId === product.id ? selected : productAssets.find((item) => item.status === "已生成") || productAssets[0];
  if (activeAsset && activeAsset.id !== state.selectedAssetId) state.selectedAssetId = activeAsset?.id || "";
  return `<div class="panel desk-panel"><div class="panel-header"><div><h3>成品预览</h3><p>满意后可直接发布，不用去别的页面。</p></div><button class="ghost-btn" type="button" data-action="open-asset-form">登记成品</button></div><div class="filter-row">${[["all", "全部"], ["image", "图片"], ["video", "视频"], ["copy", "文案"], ["ready", "待发布"]]
    .map(
      ([key, label]) =>
        `<button type="button" class="chip-btn ${state.assetFilter === key ? "active" : ""}" data-action="filter-asset" data-filter="${key}">${label}</button>`
    )
    .join("")}</div><div class="asset-grid desk-asset-grid">${filterAssetsList(productAssets).length ? filterAssetsList(productAssets).map((item) => renderAssetCard(item, true)).join("") : "<p class='meta'>还没有成品，可在左侧生成或登记。</p>"}</div>${
    activeAsset
      ? `<div class="desk-preview-wrap">${renderAssetPreview(activeAsset, product)}<div class="button-row" style="margin-top:12px"><button class="primary-btn" type="button" data-action="publish-asset" data-id="${activeAsset.id}" ${activeAsset.status !== "已生成" ? "disabled" : ""}>确认发布</button>${activeAsset.kind === "copy" && activeAsset.status === "已生成" ? `<button class="ghost-btn" type="button" data-action="start-asset-edit">编辑文案</button>` : ""}${activeAsset.kind === "image" && activeAsset.status === "已生成" ? `<button class="ghost-btn" type="button" data-action="set-primary-image" data-id="${activeAsset.id}" ${activeAsset.isPrimary ? "disabled" : ""}>设为主图</button>` : ""}</div></div>`
      : ""
  }</div>`;
}

function renderDeskStrategyPanel(product) {
  const s = state.productStrategy;
  if (!s || s.productId !== product.id) {
    return `<div class="panel desk-panel strategy-panel"><div class="panel-header"><div><h3>智能策略</h3><p>正在加载策略推荐…</p></div></div></div>`;
  }
  const assetBlock = s.recommendedAsset
    ? `<div class="strategy-block"><strong>推荐成品</strong><p>${escapeHtml(s.recommendedAsset.name)}（${escapeHtml(s.recommendedAsset.kind)} / ${s.recommendedAsset.score} 分）</p><p class="meta">${escapeHtml(s.recommendedAsset.reason)}</p>${
        s.recommendedAsset.kind === "image"
          ? `<button class="ghost-btn small-btn" type="button" data-action="apply-strategy" data-strategy="set-recommended-primary" data-product="${product.id}" data-asset="${s.recommendedAsset.assetId}">采纳为主图</button>`
          : ""
      }</div>`
    : `<div class="strategy-block"><strong>推荐成品</strong><p class="meta">暂无可用成品，生成后可获得推荐。</p></div>`;
  const templateBlock = `<div class="strategy-block"><strong>推荐流程</strong><p>「${escapeHtml(s.recommendedTemplate.name)}」</p><p class="meta">${escapeHtml(s.recommendedTemplate.reason)}</p><button class="ghost-btn small-btn" type="button" data-action="apply-strategy" data-strategy="start-recommended-workflow" data-product="${product.id}">启动推荐流程</button></div>`;
  const accountRows = (s.accountMatches || [])
    .slice(0, 3)
    .map(
      (item) =>
        `<div class="strategy-account"><div><strong>${escapeHtml(item.name)}</strong> <span class="meta">${item.score} 分 · ${escapeHtml(item.persona)}</span></div><p class="meta">${escapeHtml(item.reason)}</p></div>`
    )
    .join("");
  const accountBlock = accountRows
    ? `<div class="strategy-block"><strong>账号风格匹配</strong>${accountRows}</div>`
    : `<div class="strategy-block"><strong>账号风格匹配</strong><p class="meta">绑定内容账号后可自动匹配发布风格。</p></div>`;
  const hints = (s.hints || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<div class="panel desk-panel strategy-panel"><div class="panel-header"><div><h3>智能策略</h3><p>基于数据推荐成品、账号与流程，支持多账号差异化文案。</p></div><button class="ghost-btn" type="button" data-action="refresh-strategy" data-product="${product.id}">刷新</button></div><div class="strategy-grid">${assetBlock}${templateBlock}${accountBlock}</div><ul class="hint-list compact">${hints}</ul><div class="button-row" style="margin-top:12px"><button class="primary-btn" type="button" data-action="apply-strategy" data-strategy="start-differentiated-copy" data-product="${product.id}" ${
    (s.copyPlans || []).length ? "" : "disabled"
  }>一键差异化文案（${(s.copyPlans || []).length} 账号）</button></div></div>`;
}

function renderDeskWorkflowPanel(product) {
  const wf = getProductWorkflowInstance(product.id);
  if (!wf) {
    const templateHint = workflowTemplates.find((item) => item.name === state.workflowTemplate);
    return `<div class="panel desk-panel workflow-panel"><div class="panel-header"><div><h3>自动化流程</h3><p>选择模板后一键启动，自动串联生成与发布。</p></div></div><label class="field"><span>流程模板</span><select id="deskWorkflowTemplate">${renderWorkflowTemplateOptions()}</select></label>${templateHint ? `<p class="meta">${templateHint.steps.join(" → ")}</p>` : ""}<div class="button-row" style="margin-top:12px"><button class="primary-btn" type="button" data-action="start-workflow" data-product="${product.id}">启动流程</button></div></div>`;
  }
  return `<div class="panel desk-panel workflow-panel"><div class="panel-header"><div><h3>自动化流程 · ${escapeHtml(wf.template)}</h3><p>${escapeHtml(wf.id)} / ${statusPill(wf.status)} / 进度 ${computeWorkflowProgress(wf)}%</p></div><button class="ghost-btn" type="button" data-action="go" data-view="workflows">流程中心</button></div>${renderWorkflowNodes(wf)}${renderWorkflowActions(wf)}</div>`;
}

function renderDeskPublishPanel(product) {
  const listings = getProductListingTasks(product.id);
  const publishes = getProductPublishTasks(product.id);
  return `<div class="panel desk-panel"><div class="panel-header"><div><h3>上架与发布</h3><p>该商品的上架草稿和发布任务。</p></div></div><div class="button-row" style="margin-bottom:12px"><button class="primary-btn" type="button" data-action="create-listing" data-product="${product.id}">创建上架草稿</button><button class="ghost-btn" type="button" data-action="create-publish" data-product="${product.id}">创建发布任务</button><button class="ghost-btn" type="button" data-action="export-product-pack" data-product="${product.id}">导出 JSON 素材包</button></div><h4 class="desk-subtitle">上架草稿</h4><div class="list">${listings.length ? listings.map((task) => `<article class="task-item compact"><div><div class="task-title">${task.platform}</div><div class="meta">${task.account} / 完整度 ${task.completeness}%${Array.isArray(task.missing) && task.missing.length ? ` / 缺：${task.missing.slice(0, 3).join("、")}` : ""}</div></div>${statusPill(task.status)}</article>`).join("") : "<p class='meta'>暂无上架草稿。</p>"}</div><h4 class="desk-subtitle">发布任务</h4><div class="list">${publishes.length ? publishes.map((task) => `<article class="task-item compact"><div><div class="task-title">${task.platform}</div><div class="meta">${task.assetName ? `${task.assetName} / ` : ""}${task.time}</div></div>${statusPill(task.status)}</article>`).join("") : "<p class='meta'>暂无发布任务。</p>"}</div></div>`;
}

async function fillMissingMaterials(productId) {
  const product = productById(productId);
  const kinds = [];
  if (materialNeedsGeneration(product.imageStatus)) kinds.push("image");
  if (materialNeedsGeneration(product.copyStatus)) kinds.push("copy");
  if (materialNeedsGeneration(product.videoStatus)) kinds.push("video");
  if (!kinds.length) {
    showToast("该商品素材已齐全。");
    return;
  }
  for (const kind of kinds) {
    const params = defaultGenerationParams(kind, product);
    if (API_ENABLED) {
      await runApiAction("/api/actions/generate", { productId, kind, ...params });
    } else {
      createLocalGenerationTask(productId, kind, params);
    }
  }
  syncTaskPolling();
  showToast(`已为「${product.name}」创建 ${kinds.length} 个生成任务。`);
  openProductDesk(productId);
}

async function quickGenerate(productId, kind) {
  state.selectedProductId = productId;
  state.activeGenerator = kind;
  const product = productById(productId);
  const params = defaultGenerationParams(kind, product);
  if (API_ENABLED) {
    const ok = await runApiAction("/api/actions/generate", { productId, kind, ...params });
    if (ok) {
      syncTaskPolling();
      showToast(`${GENERATION_KIND_LABEL[kind] || kind}生成任务已创建。`);
      renderProducts();
    }
    return;
  }
  createLocalGenerationTask(productId, kind, params);
  showToast(`${GENERATION_KIND_LABEL[kind] || kind}生成任务已创建。`);
  renderProducts();
}

function filterAssetsList(items) {
  if (state.assetFilter === "all") return items;
  if (state.assetFilter === "ready") return items.filter((item) => item.status === "已生成");
  return items.filter((item) => item.kind === state.assetFilter);
}

function statusClass(status) {
  if (["已生成", "已上架", "已发布", "已授权", "库存充足", "已成功"].includes(status)) return "green";
  if (["待发布", "草稿中", "待生成", "待素材", "未发布", "待执行"].includes(status)) return "blue";
  if (["库存预警", "授权即将过期", "生成中", "执行中"].includes(status)) return "amber";
  if (["异常", "生成失败", "发布失败", "已暂停", "库存不足", "售罄", "失败"].includes(status)) return "red";
  return "violet";
}

function statusPill(status) {
  return `<span class="status ${statusClass(status)}">${status}</span>`;
}

function productPrimaryImage(productId) {
  return assets.find((item) => item.productId === productId && item.kind === "image" && item.isPrimary && item.imageUrl);
}

function renderAssetImage(asset, product, className = "asset-preview") {
  if (asset?.kind === "video" || asset?.videoUrl || asset?.posterUrl) {
    return renderVideoPreview(asset, product, className);
  }
  if (asset?.imageUrl) {
    return `<img class="${className} asset-image" src="${escapeHtml(asset.imageUrl)}" alt="${escapeHtml(asset.name)}" loading="lazy" />`;
  }
  return `<div class="${className}" style="--c1:${product.colors[0]};--c2:${product.colors[1]}"></div>`;
}

function renderVideoPreview(asset, product, className = "asset-preview") {
  if (asset.videoUrl) {
    const poster = asset.posterUrl ? ` poster="${escapeHtml(asset.posterUrl)}"` : "";
    return `<video class="${className} asset-video" src="${escapeHtml(asset.videoUrl)}"${poster} controls preload="metadata"></video>`;
  }
  if (asset.posterUrl) {
    return `<img class="${className} asset-image" src="${escapeHtml(asset.posterUrl)}" alt="${escapeHtml(asset.name)}" loading="lazy" />`;
  }
  return `<div class="${className} video" style="--c1:${product.colors[0]};--c2:${product.colors[1]}"></div>`;
}

function thumb(product, className = "thumb") {
  const primary = productPrimaryImage(product.id);
  if (primary) {
    return `<img class="${className} asset-image" src="${escapeHtml(primary.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />`;
  }
  return `<div class="${className}" style="--c1:${product.colors[0]};--c2:${product.colors[1]}"></div>`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function infoBox(label, value) {
  return `<div class="info-box"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderLog(log) {
  const actionLabel = {
    asset: "成品",
    generation: "生成",
    publish: "发布",
    workflow: "流程",
    general: "操作",
  }[log.action] || "操作";
  return `<div class="log-item"><span class="dot ${log.action || "general"}"></span><div><strong>${escapeHtml(log.text)}</strong><div class="meta">${actionLabel} / ${log.time}</div></div></div>`;
}

function renderAssetPreview(asset, product) {
  if (asset.kind === "copy") {
    const content = asset.content || `${product.name}：${product.sellingPoints}`;
    if (state.assetEditing && state.selectedAssetId === asset.id) {
      return `<form id="editAssetForm" class="product-form"><label class="field field-wide"><span>文案内容</span><textarea name="content" rows="10">${escapeHtml(content)}</textarea></label><div class="button-row"><button class="primary-btn" type="submit">保存文案</button><button class="ghost-btn" type="button" data-action="cancel-asset-edit">取消</button></div></form>`;
    }
    const variants = Array.isArray(asset.variants) && asset.variants.length ? asset.variants : [content];
    const variantButtons = variants.length > 1
      ? `<div class="filter-row">${variants.map((item, index) => `<button type="button" class="chip-btn ${(asset.selectedVariant ?? 0) === index ? "active" : ""}" data-action="select-copy-variant" data-id="${asset.id}" data-index="${index}">版本 ${index + 1}</button>`).join("")}</div>`
      : "";
    return `${variantButtons}<div class="copy-box">${escapeHtml(content).replace(/\n/g, "<br>")}</div>`;
  }
  if (asset.kind === "video") {
    const script = asset.content
      ? `<div class="copy-box" style="margin-top:12px"><strong>视频脚本</strong><br>${escapeHtml(asset.content).replace(/\n/g, "<br>")}</div>`
      : "";
    return `${renderVideoPreview(asset, product, "asset-preview video large-preview")}${script}`;
  }
  return renderAssetImage(asset, product, "large-thumb");
}

function renderAssetCard(asset, compact = false) {
  const product = productById(asset.productId);
  const sourceLabel = asset.source === "manual" ? "手动登记" : "AI 生成";
  const publishDisabled = asset.status !== "已生成" ? "disabled" : "";
  const primaryBadge = asset.isPrimary ? `<span class="status green">主图</span>` : "";
  return `
    <article class="asset-card ${state.selectedAssetId === asset.id && !compact ? "active" : ""}">
      ${renderAssetImage(asset, product, asset.kind === "video" ? "asset-preview video" : "asset-preview")}
      <div>
        <strong>${escapeHtml(asset.name)}</strong>
        <div class="meta">${escapeHtml(product.name)} / ${escapeHtml(asset.type)} / ${asset.version}</div>
        <div class="meta">${sourceLabel} / ${escapeHtml(asset.usage)} ${primaryBadge}</div>
      </div>
      <div class="inline-actions">
        ${statusPill(asset.status)}
        <button class="small-btn" data-action="preview-asset" data-id="${asset.id}">预览</button>
        <button class="small-btn" data-action="publish-asset" data-id="${asset.id}" ${publishDisabled}>发布</button>
      </div>
    </article>
  `;
}

function renderAssetPreviewPanel() {
  const asset = assetById(state.selectedAssetId);
  if (!asset) return "";
  const product = productById(asset.productId);
  return `
    <div class="panel preview-panel">
      <div class="panel-header">
        <div>
          <h2>${escapeHtml(asset.name)}</h2>
          <p>预览成品，确认无误后可一键创建发布任务。</p>
        </div>
        ${statusPill(asset.status)}
      </div>
      ${renderAssetPreview(asset, product)}
      <div class="info-grid" style="margin-top:14px">
        ${infoBox("所属商品", product.name)}
        ${infoBox("成品类型", asset.type)}
        ${infoBox("目标平台", asset.platform || product.platforms.join("、"))}
        ${asset.provider ? infoBox("生成引擎", { deepseek: "DeepSeek", runninghub: "RunningHub", api: "AI 模型", template: "模板引擎" }[asset.provider] || asset.provider) : ""}
        ${asset.duration ? infoBox("视频时长", asset.duration) : ""}
        ${asset.aspectRatio ? infoBox("画面比例", asset.aspectRatio) : ""}
        ${asset.isPrimary ? infoBox("主图状态", "当前商品主图") : ""}
        ${infoBox("绑定账号", product.accounts.join("、"))}
      </div>
      <div class="button-row" style="margin-top:16px">
        <button class="primary-btn" data-action="publish-asset" data-id="${asset.id}" ${asset.status !== "已生成" ? "disabled" : ""}>确认发布</button>
        ${asset.kind === "copy" && asset.status === "已生成" ? `<button class="ghost-btn" data-action="start-asset-edit">${state.assetEditing ? "编辑中" : "编辑文案"}</button>` : ""}
        ${asset.kind === "image" && asset.status === "已生成" ? `<button class="ghost-btn" data-action="set-primary-image" data-id="${asset.id}" ${asset.isPrimary ? "disabled" : ""}>设为主图</button>` : ""}
        <button class="ghost-btn" data-action="go" data-view="generator">重新生成</button>
      </div>
    </div>
  `;
}

function emptyProductDraft() {
  return {
    name: "",
    code: "",
    category: "待识别",
    price: "",
    stock: "",
    warningStock: "20",
    platforms: "",
    accounts: "",
    sellingPoints: "",
    specs: "",
  };
}

function readProductForm(form) {
  const data = new FormData(form);
  return {
    name: String(data.get("name") || "").trim(),
    code: String(data.get("code") || "").trim(),
    category: String(data.get("category") || "").trim(),
    price: Number(data.get("price")),
    stock: Number(data.get("stock")),
    warningStock: Number(data.get("warningStock")),
    platforms: inputToList(data.get("platforms")),
    accounts: inputToList(data.get("accounts")),
    sellingPoints: String(data.get("sellingPoints") || "").trim(),
    specs: String(data.get("specs") || "").trim(),
    autoStart: form.querySelector('[name="autoStart"]')?.checked ?? false,
  };
}

function productToFormValues(product) {
  return {
    name: product.name,
    code: product.code,
    category: product.category,
    price: product.price,
    stock: product.stock,
    warningStock: product.warningStock,
    platforms: listToInput(product.platforms),
    accounts: listToInput(product.accounts),
    sellingPoints: product.sellingPoints,
    specs: product.specs,
  };
}

function renderProductFormFields(values, formId) {
  const idPrefix = formId ? `${formId}-` : "";
  return `
    <div class="form-grid">
      <label class="field"><span>商品名称 *</span><input name="name" value="${escapeHtml(values.name)}" placeholder="例如：智能恒温杯" required /></label>
      <label class="field"><span>商品编号</span><input name="code" value="${escapeHtml(values.code)}" placeholder="例如：SKU-CUP-001" /></label>
      <label class="field"><span>类目</span><select name="category">${CATEGORY_OPTIONS.map((item) => `<option value="${item}" ${values.category === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
      <label class="field"><span>价格（元）</span><input name="price" type="number" min="0" step="0.01" value="${escapeHtml(values.price)}" /></label>
      <label class="field"><span>当前库存</span><input name="stock" type="number" min="0" value="${escapeHtml(values.stock)}" /></label>
      <label class="field"><span>预警库存</span><input name="warningStock" type="number" min="0" value="${escapeHtml(values.warningStock)}" /></label>
      <label class="field field-wide"><span>目标平台</span><input name="platforms" value="${escapeHtml(values.platforms)}" placeholder="抖音、小红书" list="${idPrefix}platform-list" /><datalist id="${idPrefix}platform-list">${PLATFORM_OPTIONS.map((item) => `<option value="${item}"></option>`).join("")}</datalist></label>
      <label class="field field-wide"><span>绑定账号</span><input name="accounts" value="${escapeHtml(values.accounts)}" placeholder="抖音内容号 A" list="${idPrefix}account-list" /><datalist id="${idPrefix}account-list">${accounts.map((item) => `<option value="${escapeHtml(item.name)}"></option>`).join("")}</datalist></label>
      <label class="field field-wide"><span>核心卖点</span><textarea name="sellingPoints">${escapeHtml(values.sellingPoints)}</textarea></label>
      <label class="field field-wide"><span>规格信息</span><textarea name="specs">${escapeHtml(values.specs)}</textarea></label>
      <label class="field field-wide checkbox-field"><input type="checkbox" name="autoStart" ${values.autoStart !== false ? "checked" : ""} /><span>创建后自动跑全流程（全自动运营）</span></label>
    </div>
  `;
}

function renderAssetFormFields(defaults) {
  const kind = defaults.kind || "image";
  return `
    <div class="form-grid">
      <label class="field"><span>绑定商品 *</span><select name="productId" required>${products.map((item) => `<option value="${item.id}" ${item.id === defaults.productId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
      <label class="field"><span>成品类型 *</span><select name="kind" data-action="asset-kind-change">${ASSET_KIND_OPTIONS.map(([key, label]) => `<option value="${key}" ${kind === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label class="field"><span>具体分类 *</span><select name="type" id="assetTypeSelect">${ASSET_TYPE_BY_KIND[kind].map((item) => `<option value="${item}">${item}</option>`).join("")}</select></label>
      <label class="field"><span>成品名称</span><input name="name" value="${escapeHtml(defaults.name || "")}" placeholder="留空则自动生成" /></label>
      <label class="field field-wide ${kind === "copy" ? "" : "hidden-field"}"><span>文案内容</span><textarea name="content" placeholder="登记文案成品时填写">${escapeHtml(defaults.content || "")}</textarea></label>
    </div>
  `;
}

function mountProductCreateModal() {
  const existing = document.querySelector("#productCreateModal");
  if (existing) existing.remove();
  if (!state.productFormOpen) return;
  const wrapper = document.createElement("div");
  wrapper.id = "productCreateModal";
  wrapper.innerHTML = `
    <div class="modal-backdrop" data-action="close-product-form">
      <section class="modal-panel" data-action="stop-propagation">
        <div class="panel-header"><div><h2>新建商品</h2><p>支持弱信息创建，只填商品名称也可以先建档。</p></div><button class="ghost-btn" type="button" data-action="close-product-form">关闭</button></div>
        <form id="createProductForm" class="product-form">${renderProductFormFields(emptyProductDraft(), "create")}<div class="button-row"><button class="primary-btn" type="submit">创建商品</button><button class="ghost-btn" type="button" data-action="close-product-form">取消</button></div></form>
      </section>
    </div>`;
  document.body.appendChild(wrapper);
}

function mountAssetCreateModal() {
  const existing = document.querySelector("#assetCreateModal");
  if (existing) existing.remove();
  if (!state.assetFormOpen) return;
  const wrapper = document.createElement("div");
  wrapper.id = "assetCreateModal";
  wrapper.innerHTML = `
    <div class="modal-backdrop" data-action="close-asset-form">
      <section class="modal-panel" data-action="stop-propagation">
        <div class="panel-header"><div><h2>登记成品</h2><p>手动登记图片、文案或视频成品，登记后可在成品库预览并发布。</p></div><button class="ghost-btn" type="button" data-action="close-asset-form">关闭</button></div>
        <form id="createAssetForm" class="product-form">${renderAssetFormFields({ productId: state.selectedProductId, kind: "image" })}<div class="button-row"><button class="primary-btn" type="submit">保存成品</button><button class="ghost-btn" type="button" data-action="close-asset-form">取消</button></div></form>
      </section>
    </div>`;
  document.body.appendChild(wrapper);
}

async function saveProduct(productId, payload) {
  if (API_ENABLED) {
    const response = await fetch(`/api/actions/products/${productId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Product update failed");
    if (result.data) applyDataState(result.data);
    return true;
  }
  const product = products.find((item) => item.id === productId);
  if (!product) return false;
  const previousStock = product.stock;
  Object.assign(product, payload, { updatedAt: "刚刚" });
  if (payload.platforms) product.platforms = payload.platforms;
  if (payload.accounts) product.accounts = payload.accounts;
  if (product.stock === 0) {
    product.status = "已暂停";
    product.publishStatus = "已暂停";
    publishTasks.filter((task) => task.productId === product.id && task.status === "待发布").forEach((task) => { task.status = "已暂停"; task.time = "库存恢复后"; });
  } else if (previousStock === 0 && product.stock > 0) {
    product.publishStatus = product.publishStatus === "已暂停" ? "待发布" : product.publishStatus;
    publishTasks.filter((task) => task.productId === product.id && task.status === "已暂停").forEach((task) => { task.status = "待发布"; task.time = "库存恢复后待排期"; });
  } else if (product.stock <= product.warningStock) {
    product.status = "库存预警";
  }
  logs.unshift({ productId: product.id, text: "更新商品资料", time: "刚刚", action: "general" });
  await persistState();
  return true;
}

async function createProduct(payload) {
  if (API_ENABLED) {
    const response = await fetch("/api/actions/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Product create failed");
    if (result.data) applyDataState(result.data);
    return result.data.products[0]?.id || "";
  }
  const id = `P${1000 + products.length + 1}`;
  products.unshift({
    id,
    name: payload.name || "未命名商品",
    code: payload.code || `SKU-DRAFT-${products.length + 1}`,
    category: payload.category || "待识别",
    price: Number.isFinite(payload.price) ? payload.price : 0,
    stock: Number.isFinite(payload.stock) ? payload.stock : 0,
    warningStock: Number.isFinite(payload.warningStock) ? payload.warningStock : 20,
    platforms: payload.platforms?.length ? payload.platforms : ["待选择"],
    accounts: payload.accounts?.length ? payload.accounts : ["未绑定"],
    status: payload.name ? "待生成" : "待完善",
    imageStatus: "未生成",
    copyStatus: "未生成",
    videoStatus: "未生成",
    listingStatus: "未上架",
    publishStatus: "未发布",
    progress: payload.name ? 18 : 8,
    updatedAt: "刚刚",
    colors: ["#e2e8f0", "#93c5fd"],
    sellingPoints: payload.sellingPoints || "待补充商品卖点。",
    specs: payload.specs || "待补充",
  });
  logs.unshift({ productId: id, text: `创建商品「${payload.name || "未命名商品"}」`, time: "刚刚", action: "general" });
  await persistState();
  return id;
}

async function registerAsset(payload) {
  if (API_ENABLED) return runApiAction("/api/actions/assets", payload);
  const product = productById(payload.productId);
  const asset = {
    id: `A${String(assets.length + 1).padStart(3, "0")}`,
    productId: payload.productId,
    name: payload.name || `${product.name}${payload.type}`,
    type: payload.type,
    kind: payload.kind,
    status: "已生成",
    usage: "成品库",
    version: "v1",
    source: "manual",
    content: payload.content || "",
  };
  assets.unshift(asset);
  product[kindToStatusField(payload.kind)] = "已生成";
  syncProductAfterGeneration(product);
  logs.unshift({ productId: payload.productId, text: `[成品] 登记「${asset.name}」`, time: "刚刚", action: "asset" });
  await persistState();
  return true;
}

async function publishAsset(assetId) {
  const asset = assetById(assetId);
  if (!asset || asset.status !== "已生成") return false;
  const product = productById(asset.productId);
  const account = getDefaultContentAccount(product);
  const payload = {
    assetId,
    productId: product.id,
    accountId: account?.id || "",
    scheduleSlot: "今天",
    scheduleTime: "18:00",
  };
  if (API_ENABLED) return runApiAction("/api/actions/publish-from-asset", payload);
  publishTasks.unshift({
    id: `PUB${String(publishTasks.length + 1).padStart(3, "0")}`,
    productId: product.id,
    assetId: asset.id,
    assetName: asset.name,
    platform: account?.platform || product.platforms[0] || "抖音",
    account: account?.name || product.accounts[0] || "抖音内容号 A",
    accountId: account?.id || "",
    status: product.stock === 0 ? "已暂停" : "待发布",
    time: "今天 18:00",
    scheduleSlot: "今天",
    attachProduct: true,
    mode: "半自动",
    failureReason: "",
    attempts: 0,
    maxAttempts: 2,
  });
  asset.status = "已发布";
  asset.usage = "发布任务";
  product.publishStatus = product.stock === 0 ? "已暂停" : "待发布";
  product[kindToStatusField(asset.kind)] = "已发布";
  logs.unshift({ productId: product.id, text: `[发布] 成品「${asset.name}」已创建发布任务`, time: "刚刚", action: "publish" });
  await persistState();
  return true;
}

async function saveAssetContent(assetId, payload) {
  if (API_ENABLED) {
    const response = await fetch(`/api/actions/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Asset update failed");
    if (result.data) applyDataState(result.data);
    return true;
  }
  const asset = assetById(assetId);
  if (!asset) return false;
  if (payload.content !== undefined) asset.content = payload.content;
  if (payload.selectedVariant !== undefined && Array.isArray(asset.variants)) {
    asset.selectedVariant = payload.selectedVariant;
    asset.content = asset.variants[payload.selectedVariant] || asset.content;
  }
  logs.unshift({ productId: asset.productId, text: `[成品] 更新文案「${asset.name}」`, time: "刚刚", action: "asset" });
  await persistState();
  return true;
}

async function loadCopyProvider() {
  if (!API_ENABLED) return;
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    state.copyProvider = data.copyProvider || "template";
    state.imageProvider = data.imageProvider || "template";
    state.videoProvider = data.videoProvider || "template";
  } catch (error) {
    state.copyProvider = "template";
    state.imageProvider = "template";
    state.videoProvider = "template";
  }
}

function generationKindMeta(kind) {
  const typeMap = {
    image: ["主图", "AI 图片"],
    copy: ["发布文案", "AI 文案"],
    video: ["短视频", "AI 视频"],
  };
  const [type, label] = typeMap[kind] || typeMap.image;
  return { type, label };
}

function createLocalGenerationTask(productId, kind, params = {}) {
  const product = productById(productId);
  const meta = kind === "copy" && params.copyType
    ? { type: params.copyType, label: "AI 文案" }
    : kind === "image" && params.imageType
      ? { type: params.imageType, label: "AI 图片" }
      : kind === "video" && params.videoType
        ? { type: params.videoType, label: "AI 视频" }
        : generationKindMeta(kind);
  const { type, label } = meta;
  const task = {
    id: `GT${String(generationTasks.length + 1).padStart(3, "0")}`,
    productId,
    productName: product.name,
    kind,
    type,
    label,
    params,
    status: "待执行",
    assetId: "",
    assetName: "",
    error: "",
    attempts: 1,
    maxAttempts: 3,
    createdAt: "刚刚",
    updatedAt: "刚刚",
    startedAt: "",
    finishedAt: "",
  };
  generationTasks.unshift(task);
  state.selectedTaskId = task.id;
  product[kindToStatusField(kind)] = "生成中";
  syncProductAfterGeneration(product);
  logs.unshift({ productId, text: `[生成] ${type}任务已创建（${task.id}）`, time: "刚刚", action: "generation" });
  scheduleLocalGenerationTask(task.id);
  persistState();
}

function buildLocalCopyVariants(product, params) {
  const copyType = params.copyType || "发布文案";
  const platform = params.platform || product.platforms[0] || "抖音";
  const count = Math.min(5, Math.max(1, Number(params.versionCount) || 3));
  const hook = (product.sellingPoints || "").split(/[、，,]/)[0] || product.name;
  const templates = {
    商品标题: (i) => [`${product.name}｜${hook}`, `【${platform}】${product.name}`, `${hook}必备 ${product.name}`][i % 3],
    核心卖点: (i) => [`1. ${hook}\n2. ${product.sellingPoints}\n3. ${product.specs}`, `核心优势：${product.sellingPoints}`, `${product.name}：${product.sellingPoints}`][i % 3],
    详情文案: (i) => [`${product.name}\n\n${product.sellingPoints}\n\n规格：${product.specs}`, `${product.name} 适合 ${product.category} 用户。${product.sellingPoints}`, `【${platform}详情】${product.name}，${product.sellingPoints}`][i % 3],
    视频脚本: (i) => [`[开场] ${hook}？\n[展示] ${product.name}\n[转化] ¥${product.price}`, `镜头1 痛点\n镜头2 产品\n镜头3 下单`, `${product.name} 口播：${product.sellingPoints}`][i % 3],
    发布文案: (i) => [`${hook}！${product.name}，${product.sellingPoints}`, `【${platform}分享】${product.name} 真的好用`, `${product.name}：${product.sellingPoints}`][i % 3],
  };
  const builder = templates[copyType] || templates["发布文案"];
  return Array.from({ length: count }, (_, index) => builder(index));
}

function finishLocalGenerationTask(taskId) {
  const task = taskById(taskId);
  if (!task || task.status !== "执行中") return;
  const product = productById(task.productId);
  const failRate = { copy: 0.05, image: 0.08, video: 0.2 }[task.kind] || 0;
  if (Math.random() < failRate) {
    task.status = "失败";
    task.error = task.kind === "video" ? "视频渲染超时，请重试" : "生成服务暂时不可用";
    task.finishedAt = "刚刚";
    task.updatedAt = "刚刚";
    product[kindToStatusField(task.kind)] = "生成失败";
    syncProductAfterGeneration(product);
    logs.unshift({ productId: product.id, text: `[生成] ${task.label}失败：${task.error}（${task.id}）`, time: "刚刚", action: "generation" });
    persistState();
    if (["dashboard", "generator", "tasks"].includes(state.view)) render();
    return;
  }
  const asset = {
    id: `A${String(assets.length + 1).padStart(3, "0")}`,
    productId: product.id,
    name: `${product.name}${task.label} ${assets.filter((item) => item.productId === product.id && item.type === task.type).length + 1}`,
    type: task.type,
    status: "已生成",
    usage: "成品库",
    version: "v1",
    kind: task.kind === "copy" ? "copy" : task.kind,
    source: "generated",
    content: "",
    generationTaskId: task.id,
  };
  if (task.kind === "copy") {
    const variants = buildLocalCopyVariants(product, task.params || {});
    asset.variants = variants;
    asset.content = variants[0];
    asset.copyType = task.params?.copyType || task.type;
    asset.platform = task.params?.platform || product.platforms[0] || "抖音";
    asset.provider = "template";
    assets.unshift(asset);
    task.assetId = asset.id;
    task.assetName = asset.name;
    state.selectedAssetId = asset.id;
  } else if (task.kind === "image") {
    const count = Math.min(6, Math.max(1, Number(task.params?.imageCount) || 4));
    const imageType = task.params?.imageType || task.type;
    const hasPrimary = assets.some((item) => item.productId === product.id && item.isPrimary);
    const created = [];
    for (let index = 0; index < count; index += 1) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960"><rect width="100%" height="100%" fill="${product.colors[0]}"/><text x="48" y="120" font-size="36" fill="#0f172a">${product.name}</text><text x="48" y="180" font-size="22" fill="#475569">${imageType} v${index + 1}</text></svg>`;
      const imageAsset = {
        id: `A${String(assets.length + created.length + 1).padStart(3, "0")}`,
        productId: product.id,
        name: `${product.name}${imageType} ${assets.filter((item) => item.productId === product.id && item.type === imageType).length + index + 1}`,
        type: imageType,
        status: "已生成",
        usage: "成品库",
        version: "v1",
        kind: "image",
        source: "generated",
        imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        imageType,
        provider: "template",
        isPrimary: !hasPrimary && index === 0,
        generationTaskId: task.id,
      };
      assets.unshift(imageAsset);
      created.push(imageAsset);
    }
    task.assetId = created[0]?.id || "";
    task.assetName = created.length > 1 ? `${created.length}张${imageType}` : created[0]?.name || "";
    task.imageCount = created.length;
    state.selectedAssetId = created[0]?.id || state.selectedAssetId;
  } else if (task.kind === "video") {
    const videoType = task.params?.videoType || task.type;
    const ratioLabel = task.params?.videoRatio || "9:16 竖版";
    const duration = task.params?.videoDuration || "15 秒";
    const hook = (product.sellingPoints || "").split(/[、，,]/)[0] || product.name;
    const script =
      String(task.params?.extraPrompt || "").trim() ||
      `[0-3s] 开场：${hook}，真的值得看看\n[3-12s] 展示：${product.name}，${product.sellingPoints}\n[12-15s] 转化：${product.specs}，适合${product.category}场景`;
    const width = ratioLabel.includes("1:1") ? 960 : ratioLabel.includes("16:9") ? 1280 : 720;
    const height = ratioLabel.includes("1:1") ? 960 : ratioLabel.includes("16:9") ? 720 : 1280;
    const posterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${product.colors[0]}"/><stop offset="100%" stop-color="${product.colors[1]}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><polygon points="${width / 2 - 24},${height / 2 - 32} ${width / 2 - 24},${height / 2 + 32} ${width / 2 + 34},${height / 2}" fill="#ffffff"/><text x="48" y="72" font-size="34" fill="#ffffff">${product.name}</text><text x="48" y="118" font-size="22" fill="#e2e8f0">${videoType} · ${duration}</text></svg>`;
    asset.content = script;
    asset.videoType = videoType;
    asset.aspectRatio = ratioLabel.includes("9:16") ? "9:16" : ratioLabel.includes("16:9") ? "16:9" : "1:1";
    asset.duration = duration;
    asset.posterUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(posterSvg)}`;
    asset.videoUrl = "";
    asset.provider = "template";
    assets.unshift(asset);
    task.assetId = asset.id;
    task.assetName = asset.name;
    state.selectedAssetId = asset.id;
  } else {
    assets.unshift(asset);
    task.assetId = asset.id;
    task.assetName = asset.name;
    state.selectedAssetId = asset.id;
  }
  task.status = "已成功";
  task.finishedAt = "刚刚";
  task.updatedAt = "刚刚";
  product[kindToStatusField(task.kind)] = "已生成";
  syncProductAfterGeneration(product);
  const note = task.kind === "image" && task.imageCount > 1 ? `，新增 ${task.imageCount} 张图片` : `，成品「${task.assetName}」已保存`;
  logs.unshift({ productId: product.id, text: `[生成] ${task.type}完成${note}（${task.id}）`, time: "刚刚", action: "generation" });
  persistState();
  if (["dashboard", "generator", "tasks", "assets"].includes(state.view)) render();
}

function scheduleLocalGenerationTask(taskId) {
  const task = taskById(taskId);
  if (!task || task.status !== "待执行") return;
  const delay = { copy: 1200, image: 2200, video: 4500 }[task.kind] || 2000;
  task.status = "执行中";
  task.startedAt = "刚刚";
  task.updatedAt = "刚刚";
  window.setTimeout(() => finishLocalGenerationTask(taskId), delay);
}

function retryLocalGenerationTask(taskId) {
  const task = taskById(taskId);
  if (!task || task.status !== "失败" || task.attempts >= task.maxAttempts) return false;
  const product = productById(task.productId);
  task.status = "待执行";
  task.error = "";
  task.attempts += 1;
  task.updatedAt = "刚刚";
  task.startedAt = "";
  task.finishedAt = "";
  product[kindToStatusField(task.kind)] = "生成中";
  syncProductAfterGeneration(product);
  logs.unshift({ productId: product.id, text: `[生成] 重试任务 ${task.id}（第 ${task.attempts} 次）`, time: "刚刚", action: "generation" });
  scheduleLocalGenerationTask(task.id);
  persistState();
  return true;
}

function renderGenerationTaskRow(task) {
  const kindLabel = GENERATION_KIND_LABEL[task.kind] || task.kind;
  const retryDisabled = task.status !== "失败" || task.attempts >= task.maxAttempts ? "disabled" : "";
  const assetAction = task.assetId
    ? `<button class="small-btn" data-action="preview-asset" data-id="${task.assetId}">查看成品</button>`
    : "";
  return `
    <article class="task-item ${state.selectedTaskId === task.id ? "active-task" : ""}" data-action="select-task" data-id="${task.id}">
      <div>
        <div class="task-title">${escapeHtml(task.productName)} / ${kindLabel}</div>
        <div class="meta">${task.id} / ${task.type} / 第 ${task.attempts} 次 / ${task.updatedAt}</div>
        ${task.error ? `<div class="meta task-error">${escapeHtml(task.error)}</div>` : ""}
      </div>
      <div class="inline-actions">
        ${statusPill(task.status)}
        ${assetAction}
        <button class="small-btn" data-action="retry-generation" data-id="${task.id}" ${retryDisabled}>重试</button>
      </div>
    </article>
  `;
}

function renderTaskDetailPanel() {
  const task = taskById(state.selectedTaskId);
  if (!task) return "";
  const product = productById(task.productId);
  const asset = task.assetId ? assetById(task.assetId) : null;
  return `
    <div class="panel preview-panel">
      <div class="panel-header">
        <div>
          <h2>${task.id}</h2>
          <p>${escapeHtml(task.productName)} · ${GENERATION_KIND_LABEL[task.kind] || task.kind} · ${task.type}</p>
        </div>
        ${statusPill(task.status)}
      </div>
      <div class="info-grid">
        ${infoBox("任务状态", task.status)}
        ${infoBox("尝试次数", `${task.attempts} / ${task.maxAttempts}`)}
        ${infoBox("创建时间", task.createdAt)}
        ${infoBox("最近更新", task.updatedAt)}
        ${infoBox("开始时间", task.startedAt || "—")}
        ${infoBox("完成时间", task.finishedAt || "—")}
      </div>
      ${task.error ? `<div class="copy-box task-error-box">${escapeHtml(task.error)}</div>` : ""}
      ${asset ? `<div style="margin-top:14px">${renderAssetPreview(asset, product)}</div>` : `<p class="meta" style="margin-top:14px">${ACTIVE_TASK_STATUSES.includes(task.status) ? "任务执行中，完成后会自动写入成品库。" : "暂无关联成品。"}</p>`}
      <div class="button-row" style="margin-top:16px">
        ${task.assetId ? `<button class="primary-btn" data-action="preview-asset" data-id="${task.assetId}">查看成品</button>` : ""}
        <button class="ghost-btn" data-action="retry-generation" data-id="${task.id}" ${task.status !== "失败" || task.attempts >= task.maxAttempts ? "disabled" : ""}>重试任务</button>
        <button class="ghost-btn" data-action="go" data-view="generator">继续生成</button>
      </div>
    </div>
  `;
}

function renderTopActions() {
  if (!topActions) return;
  const actionMap = {
    dashboard: `<button class="primary-btn" data-action="open-product-form">新建商品</button>`,
    products: `<button class="ghost-btn" data-action="toggle-product-edit">${state.productEditing ? "收起资料" : "编辑资料"}</button><button class="primary-btn" data-action="open-product-form">新建商品</button>`,
    publish: `<button class="ghost-btn" data-action="go" data-view="accounts">平台账号</button><button class="primary-btn" data-action="open-publish-form">新建发布任务</button>`,
    assets: `<button class="ghost-btn" data-action="go" data-view="products">返回运营台</button><button class="primary-btn" data-action="open-asset-form">登记成品</button>`,
    tasks: `<button class="ghost-btn" data-action="go" data-view="products">商品运营台</button>`,
    workflows: `<button class="ghost-btn" data-action="go" data-view="products">商品运营台</button><button class="primary-btn" data-action="batch-start-workflow">批量启动</button>`,
    generator: `<button class="ghost-btn" data-action="go" data-view="products">商品运营台</button><button class="primary-btn" data-action="run-generator">开始生成</button>`,
    inventory: `<button class="ghost-btn" data-action="go" data-view="products">商品运营台</button>`,
    data: `<button class="ghost-btn" type="button" data-action="refresh-analytics">刷新数据</button>`,
  };
  topActions.innerHTML = actionMap[state.view] || actionMap.dashboard;
}

function setView(view) {
  state.view = view;
  pageTitle.textContent = titles[view];
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  renderTopActions();
  if (view === "data") {
    Promise.all([loadAnalytics(), loadStrategySummary(), loadTemplateAb()]).then(() => render());
    return;
  }
  if (view === "workflows") {
    Promise.all([loadWorkflowOrchestratorData(), loadWorkflowTemplates()]).then(() => render());
    return;
  }
  if (view === "products") {
    loadProductStrategy(state.selectedProductId).then(() => renderProducts());
    return;
  }
  render();
}

function renderInboxItem(item) {
  return `<article class="inbox-item inbox-${item.tone}"><div><div class="task-title">${escapeHtml(item.title)}</div><div class="meta">${escapeHtml(item.meta)}</div></div><button class="small-btn primary-inline" data-action="${item.action}" data-view="${item.view || ""}" data-product="${item.productId || ""}" data-asset="${item.assetId || ""}" data-task="${item.taskId || ""}" data-workflow="${item.workflowId || ""}">${escapeHtml(item.cta)}</button></article>`;
}

function renderListingTaskRow(task) {
  const product = productById(task.productId);
  const canExecute = ["草稿中", "待补充", "库存预警", "失败"].includes(task.status);
  const canRetry = task.status === "失败" && (task.attempts || 0) < (task.maxAttempts || 2);
  return `<article class="task-item"><div><div class="task-title">${escapeHtml(product.name)} / ${escapeHtml(task.platform)}</div><div class="meta">${escapeHtml(task.account)} / 完整度 ${task.completeness}%${task.platformMode ? ` / ${task.platformMode}` : ""}</div>${task.failureReason ? `<div class="meta task-error">${escapeHtml(task.failureReason)}</div>` : ""}<div class="progress"><span style="--value:${task.completeness}%"></span></div></div><div class="inline-actions">${statusPill(task.status)}${canExecute ? `<button class="small-btn primary-inline" type="button" data-action="execute-listing" data-id="${task.id}">平台上架</button>` : ""}${canRetry ? `<button class="small-btn" type="button" data-action="retry-listing" data-id="${task.id}">重试</button>` : ""}</div></article>`;
}

function renderPlatformCapabilities() {
  const items = state.platformCapabilities.length
    ? state.platformCapabilities
    : [{ platform: "加载中", summary: ["—"], hasLiveApi: false }];
  return `<section class="panel"><div class="panel-header"><div><h2>平台能力分级</h2><p>各平台独立适配，接不了 API 不影响导出发布。</p></div></div><div class="grid three-col">${items
    .map(
      (item) =>
        `<article class="account-card"><div class="panel-header"><div><h3>${escapeHtml(item.platform)}</h3><p>${item.hasLiveApi ? "已配置 OpenAPI" : "模拟 / 导出模式"}</p></div>${statusPill(item.hasLiveApi ? "已授权" : "模板模式")}</div><div class="info-grid">${infoBox("能力", (item.summary || []).join("、"))}${infoBox("最高能力", item.highest || item.summary?.[item.summary.length - 1] || "导出发布")}</div></article>`
    )
    .join("")}</div></section>`;
}

function renderAutoOpsPanel() {
  const eligible = getEligibleAutoOpsProducts();
  const running = workflowInstances.filter((item) => item.template === "全自动运营" && ["执行中", "等待确认"].includes(item.status)).length;
  const waiting = workflowInstances.filter((item) => item.template === "全自动运营" && item.status === "等待确认").length;
  return `<section class="panel"><div class="panel-header"><div><h2>全自动运营</h2><p>上传商品后自动跑主流程，你只需在预览确认和异常处介入。</p></div><button class="ghost-btn" type="button" data-action="go" data-view="workflows">流程中心</button></div><div class="info-grid" style="margin-bottom:14px">${infoBox("可启动", eligible.length)}${infoBox("运行中", running)}${infoBox("待你确认", waiting)}</div><div class="batch-workflow-bar"><label class="field inline-field checkbox-field"><input type="checkbox" id="autoOpsMultiAccount" checked /><span>多账号矩阵分发</span></label><label class="field inline-field checkbox-field"><input type="checkbox" id="autoOpsAutoExecute" checked /><span>确认后自动上架发布</span></label><button class="primary-btn" type="button" data-action="batch-start-auto-ops" ${eligible.length ? "" : "disabled"}>一键全自动（${eligible.length}）</button></div><p class="meta">新建商品时可勾选「创建后自动跑全流程」，或在此批量启动已有商品。</p></section>`;
}

function renderDashboard() {
  const inbox = buildInboxItems();
  root.innerHTML = `${renderKpis()}${renderAutoOpsPanel()}<section class="panel"><div class="panel-header"><div><h2>待办收件箱</h2><p>只显示需要你处理的事项，点击后直接进入对应商品运营台。</p></div><button class="ghost-btn" data-action="go" data-view="products">全部商品</button></div><div class="list inbox-list">${inbox.length ? inbox.map(renderInboxItem).join("") : `<div class="empty-state"><h3>暂无待办</h3><p class="meta">可以去商品运营台新建商品，或一键补全素材。</p><button class="primary-btn" data-action="go" data-view="products">打开商品运营台</button></div>`}</div></section><section class="panel"><div class="panel-header"><div><h2>商品概览</h2><p>快速进入某个商品的运营台。</p></div></div>${renderProductTable(products)}</section>`;
}

function renderProducts() {
  const product = productById(state.selectedProductId);
  const productLogs = logs.filter((item) => item.productId === product.id).slice(0, 8);
  root.innerHTML = `<section class="panel desk-header-panel"><div class="panel-header"><div><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.code)} / ${escapeHtml(product.category)} / 库存 ${product.stock}</p></div>${statusPill(product.status)}</div>${renderProductPicker()}${renderProgressSteps(product)}</section>${renderDeskStrategyPanel(product)}${renderDeskWorkflowPanel(product)}<section class="product-desk">${renderInlineGenerator(product)}${renderDeskAssetPanel(product)}${renderDeskPublishPanel(product)}</section><section class="panel desk-meta-panel"><div class="panel-header"><div><h3>商品资料与日志</h3><p>必要信息保留在此，默认折叠，需要时再展开。</p></div><button class="ghost-btn" type="button" data-action="toggle-product-edit">${state.productEditing || state.productDeskExpanded ? "收起" : "展开编辑"}</button></div>${
    state.productEditing || state.productDeskExpanded
      ? `<div class="detail-layout"><div class="detail-hero">${thumb(product, "large-thumb")}${state.productEditing ? `<form id="editProductForm" class="product-form detail-form">${renderProductFormFields(productToFormValues(product), "edit")}</form>` : `<div class="info-grid">${infoBox("价格", `¥${product.price}`)}${infoBox("目标平台", product.platforms.join("、"))}${infoBox("绑定账号", product.accounts.join("、"))}${infoBox("卖点", product.sellingPoints)}${infoBox("规格", product.specs)}</div>`}</div><div class="timeline">${productLogs.map(renderLog).join("") || "<p class='meta'>暂无日志。</p>"}</div></div>`
      : `<p class="meta">图片 ${product.imageStatus} / 文案 ${product.copyStatus} / 视频 ${product.videoStatus} / 上架 ${product.listingStatus} / 发布 ${product.publishStatus}</p>`
  }</section>`;
}

function kpi(label, value, note, color) {
  return `<article class="kpi-card" style="--accent:${color}"><span class="kpi-label">${label}</span><strong class="kpi-value">${value}</strong><p class="kpi-note">${note}</p></article>`;
}

function renderKpis() {
  const readyAssets = assets.filter((item) => item.status === "已生成").length;
  const lowStock = products.filter((item) => item.stock <= item.warningStock).length;
  const pendingPublish = publishTasks.filter((item) => item.status === "待发布").length;
  const running = generationTasks.filter((item) => ACTIVE_TASK_STATUSES.includes(item.status)).length;
  return `<section class="grid kpi-grid">${kpi("待发布成品", readyAssets, "预览满意后可一键发布", "#2563eb")}${kpi("生成中任务", running, "图片、文案、视频异步执行中", "#0f9f8f")}${kpi("待发布内容", pendingPublish, "已排期或待确认发布", "#6d5bd0")}${kpi("库存预警商品", lowStock, "低库存会拦截发布", "#b7791f")}</section>`;
}

function renderProductTable(items) {
  return `<div class="table-wrap"><table><thead><tr><th>商品</th><th>类目</th><th>库存</th><th>图片</th><th>文案</th><th>视频</th><th>上架</th><th>发布</th><th>操作</th></tr></thead><tbody>${items.map((product) => `<tr><td><div class="product-cell">${thumb(product)}<div><strong>${product.name}</strong><div class="meta">${product.code}</div></div></div></td><td>${product.category}</td><td>${product.stock}</td><td>${statusPill(product.imageStatus)}</td><td>${statusPill(product.copyStatus)}</td><td>${statusPill(product.videoStatus)}</td><td>${statusPill(product.listingStatus)}</td><td>${statusPill(product.publishStatus)}</td><td><button class="small-btn" data-action="select-product" data-id="${product.id}">运营台</button></td></tr>`).join("")}</tbody></table></div>`;
}

function readGeneratorForm() {
  const form = document.querySelector("#generatorForm");
  if (!form) return {};
  const data = new FormData(form);
  if (state.activeGenerator === "copy") {
    return {
      copyType: String(data.get("copyType") || "发布文案"),
      platform: String(data.get("platform") || "抖音"),
      versionCount: Number(data.get("versionCount") || 3),
      extraPrompt: String(data.get("extraPrompt") || "").trim(),
      accountId: String(data.get("accountId") || "").trim(),
    };
  }
  if (state.activeGenerator === "image") {
    return {
      imageType: String(data.get("imageType") || "商品主图"),
      imageSize: String(data.get("imageSize") || "1:1 平台主图"),
      imageCount: Number(data.get("imageCount") || 4),
      extraPrompt: String(data.get("extraPrompt") || "").trim(),
    };
  }
  return {
    videoType: String(data.get("videoType") || "商品展示视频"),
    videoRatio: String(data.get("videoRatio") || "9:16 竖版"),
    videoDuration: String(data.get("videoDuration") || "15 秒"),
    extraPrompt: String(data.get("extraPrompt") || "").trim(),
  };
}

function renderGeneratorFields() {
  if (state.activeGenerator === "image") {
    const providerNote = {
      runninghub: "已接入 RunningHub 图片生成",
      template: "当前使用模板预览（在 .env 配置 RUNNINGHUB_API_KEY 可切换）",
    }[state.imageProvider] || "当前使用模板预览";
    return `<label class="field"><span>图片类型</span><select name="imageType">${["商品主图", "详情页图", "卖点图", "封面图"].map((item) => `<option value="${item}">${item}</option>`).join("")}</select></label><label class="field"><span>输出尺寸</span><select name="imageSize"><option value="1:1 平台主图">1:1 平台主图</option><option value="3:4 小红书">3:4 小红书</option><option value="9:16 竖版">9:16 竖版</option></select></label><label class="field"><span>生成数量</span><select name="imageCount"><option value="1">1 张</option><option value="2">2 张</option><option value="4" selected>4 张</option><option value="6">6 张</option></select></label><label class="field field-wide"><span>风格要求</span><textarea name="extraPrompt">真实商品质感，干净背景，突出核心卖点。</textarea></label><p class="meta">${providerNote}</p>`;
  }
  if (state.activeGenerator === "copy") {
    const product = productById(state.selectedProductId);
    const defaultAccount = getDefaultContentAccount(product);
    const providerNote = {
      deepseek: "已接入 DeepSeek 文案模型",
      api: "已接入 AI 文案模型",
      template: "当前使用模板引擎（在 .env 配置 COPY_API_KEY 可切换）",
    }[state.copyProvider] || "当前使用模板引擎";
    return `<label class="field"><span>文案类型</span><select name="copyType">${COPY_TYPE_OPTIONS.map((item) => `<option value="${item}">${item}</option>`).join("")}</select></label><label class="field"><span>发布账号</span><select name="accountId">${renderAccountOptions(product, defaultAccount?.id || "")}</select></label><label class="field"><span>目标平台</span><select name="platform">${PLATFORM_OPTIONS.map((item) => `<option value="${item}">${item}</option>`).join("")}</select></label><label class="field"><span>生成版本数</span><select name="versionCount"><option value="1">1 版</option><option value="2">2 版</option><option value="3" selected>3 版</option><option value="4">4 版</option><option value="5">5 版</option></select></label><label class="field field-wide"><span>额外要求</span><textarea name="extraPrompt" placeholder="例如：不要夸大宣传，强调使用场景和购买理由。">不要夸大宣传，强调使用场景和购买理由。</textarea></label><p class="meta">${providerNote} · 不同账号人设会生成不同风格文案</p>`;
  }
  return `<label class="field"><span>视频类型</span><select name="videoType">${["商品展示视频", "图文混剪视频", "商品讲解视频"].map((item) => `<option value="${item}">${item}</option>`).join("")}</select></label><label class="field"><span>视频比例</span><select name="videoRatio"><option value="9:16 竖版">9:16 竖版</option><option value="1:1 方版">1:1 方版</option><option value="16:9 横版">16:9 横版</option></select></label><label class="field"><span>时长</span><select name="videoDuration"><option value="15 秒">15 秒</option><option value="30 秒">30 秒</option></select></label><label class="field field-wide"><span>脚本 / 额外要求</span><textarea name="extraPrompt" placeholder="可填写分镜脚本；留空则根据商品资料自动生成。"></textarea></label><p class="meta">${{
    runninghub: "已接入 RunningHub 视频生成",
    template: "当前使用模板预览（在 .env 配置 RUNNINGHUB_API_KEY 可切换）",
  }[state.videoProvider] || "当前使用模板预览"}</p>`;
}

function renderGenerator() {
  const product = productById(state.selectedProductId);
  const productTasks = generationTasks.filter((item) => item.productId === product.id).slice(0, 5);
  root.innerHTML = `<section class="grid two-col"><div class="panel"><div class="panel-header"><div><h2>AI 生成工作台</h2><p>${state.activeGenerator === "copy" ? "文案生成支持多版本，完成后可在成品库预览、编辑并发布。" : state.activeGenerator === "image" ? "图片生成支持多图版本，完成后进入成品库，可设为主图并发布。" : "视频生成支持脚本确认与封面预览，完成后自动保存到成品库。"}</p></div></div><div class="tabs">${[["image", "图片生成"], ["copy", "文案生成"], ["video", "视频生成"]].map(([key, label]) => `<button class="tab-btn ${state.activeGenerator === key ? "active" : ""}" data-action="generator-tab" data-tab="${key}">${label}</button>`).join("")}</div><form id="generatorForm" class="form-grid" data-action="stop-propagation"><label class="field"><span>选择商品</span><select data-action="choose-product">${products.map((item) => `<option value="${item.id}" ${item.id === product.id ? "selected" : ""}>${item.name}</option>`).join("")}</select></label>${renderGeneratorFields()}</form><div class="button-row" style="margin-top:14px"><button class="primary-btn" data-action="run-generator">开始生成</button><button class="ghost-btn" data-action="go" data-view="tasks">查看任务</button><button class="ghost-btn" data-action="go" data-view="assets">成品库</button></div></div><div class="panel"><div class="panel-header"><div><h2>当前商品上下文</h2><p>生成输入自动读取商品资料。</p></div>${statusPill(product.status)}</div>${thumb(product, "large-thumb")}<div class="info-grid" style="margin-top:14px">${infoBox("商品", product.name)}${infoBox("类目", product.category)}${infoBox("库存", product.stock)}${infoBox("卖点", product.sellingPoints)}</div></div></section><section class="panel"><div class="panel-header"><div><h2>当前商品生成任务</h2><p>任务状态会自动刷新，失败任务可重试。</p></div></div><div class="list">${productTasks.length ? productTasks.map(renderGenerationTaskRow).join("") : "<p class='meta'>还没有生成任务，点击「开始生成」创建。</p>"}</div></section><section class="panel"><div class="panel-header"><div><h2>最近生成成品</h2><p>生成结果不覆盖旧版本，统一进入成品库。</p></div></div><div class="result-grid">${assets.slice(0, 6).map((item) => renderAssetCard(item, true)).join("")}</div></section>`;
}

function renderWorkflowRow(wf) {
  const active = wf.nodes.find((node) => !["已成功", "已跳过"].includes(node.status));
  const progress = computeWorkflowProgress(wf);
  return `<article class="task-item workflow-row ${state.selectedWorkflowId === wf.id ? "selected" : ""}"><div><div class="task-title">${escapeHtml(wf.productName)} · ${escapeHtml(wf.template)}</div><div class="meta">${wf.id} / ${active?.label || "已完成"} / ${wf.updatedAt || wf.createdAt}</div><div class="progress"><span style="--value:${progress}%"></span></div></div><div class="inline-actions">${statusPill(wf.status)}<button class="small-btn" type="button" data-action="select-workflow" data-id="${wf.id}">详情</button><button class="small-btn" type="button" data-action="open-product-desk" data-product="${wf.productId}" data-workflow="${wf.id}">运营台</button></div></article>`;
}

function renderWorkflowDetailPanel() {
  const wf = workflowById(state.selectedWorkflowId) || filterWorkflowInstances()[0];
  if (wf && wf.id !== state.selectedWorkflowId) state.selectedWorkflowId = wf.id;
  if (!wf) {
    return `<div class="panel"><div class="panel-header"><div><h2>流程详情</h2><p>选择左侧流程查看节点与操作。</p></div></div><p class="meta">暂无流程实例。</p></div>`;
  }
  return `<div class="panel"><div class="panel-header"><div><h2>${escapeHtml(wf.productName)}</h2><p>${escapeHtml(wf.id)} / ${escapeHtml(wf.template)}</p></div>${statusPill(wf.status)}</div><div class="info-grid" style="margin-bottom:14px">${infoBox("进度", `${computeWorkflowProgress(wf)}%`)}${infoBox("创建时间", wf.createdAt)}${infoBox("最近更新", wf.updatedAt)}${infoBox("当前节点", wf.nodes.find((node) => !["已成功", "已跳过"].includes(node.status))?.label || "已完成")}</div>${renderWorkflowNodes(wf)}${renderWorkflowActions(wf)}<div class="button-row" style="margin-top:12px"><button class="ghost-btn" type="button" data-action="open-product-desk" data-product="${wf.productId}" data-workflow="${wf.id}">打开商品运营台</button></div></div>`;
}

function renderWorkflows() {
  const filtered = filterWorkflowInstances();
  const failedCount = workflowInstances.filter((item) => item.status === "失败").length;
  const runningCount = workflowInstances.filter((item) => ["执行中", "等待确认"].includes(item.status)).length;
  const eligible = getEligibleBatchProducts();
  if (!state.selectedWorkflowId && filtered[0]) state.selectedWorkflowId = filtered[0].id;
  root.innerHTML = `${renderWorkflowOrchestratorPanel()}<section class="assets-layout"><div class="panel"><div class="panel-header"><div><h2>自动化流程中心</h2><p>批量启动、异常处理、流程进度一览。</p></div></div><div class="info-grid" style="margin-bottom:14px">${infoBox("执行中", runningCount)}${infoBox("异常待处理", failedCount)}${infoBox("可批量启动", eligible.length)}</div><div class="filter-row">${[["active", "进行中"], ["failed", "异常"], ["done", "已完成"], ["all", "全部"]].map(([key, label]) => `<button type="button" class="chip-btn ${state.workflowFilter === key ? "active" : ""}" data-action="filter-workflow" data-filter="${key}">${label}</button>`).join("")}</div><div class="batch-workflow-bar"><label class="field inline-field"><span>批量模板</span><select id="batchWorkflowTemplate">${renderWorkflowTemplateOptions()}</select></label><button class="primary-btn" type="button" data-action="batch-start-workflow" ${eligible.length ? "" : "disabled"}>批量启动 ${eligible.length} 个商品</button></div><div class="list workflow-list">${filtered.length ? filtered.map(renderWorkflowRow).join("") : `<div class="empty-state"><h3>暂无${state.workflowFilter === "failed" ? "异常" : ""}流程</h3><p class="meta">可在商品运营台为单个商品启动流程，或批量启动待处理商品。</p><button class="primary-btn" data-action="go" data-view="products">商品运营台</button></div>`}</div></div>${renderWorkflowDetailPanel()}</section>`;
}

function renderTasks() {
  const activeCount = generationTasks.filter((item) => ACTIVE_TASK_STATUSES.includes(item.status)).length;
  const failedCount = generationTasks.filter((item) => item.status === "失败").length;
  root.innerHTML = `<section class="assets-layout"><div class="panel"><div class="panel-header"><div><h2>生成任务中心</h2><p>统一管理图片、文案、视频异步生成任务。</p></div><div class="inline-actions"><button class="ghost-btn" data-action="go" data-view="generator">发起生成</button><button class="primary-btn" data-action="go" data-view="assets">成品库</button></div></div><div class="info-grid" style="margin-bottom:14px">${infoBox("执行中", activeCount)}${infoBox("失败待重试", failedCount)}${infoBox("任务总数", generationTasks.length)}</div><div class="list">${generationTasks.length ? generationTasks.map(renderGenerationTaskRow).join("") : "<p class='meta'>还没有生成任务。</p>"}</div></div>${renderTaskDetailPanel()}</section>`;
}

function renderAssets() {
  const filtered = filterAssetsList(assets);
  root.innerHTML = `<section class="assets-layout"><div class="panel"><div class="panel-header"><div><h2>商品成品库</h2><p>AI 生成或手动登记的成品，预览满意后可直接发布。</p></div><div class="inline-actions"><button class="ghost-btn" data-action="go" data-view="generator">AI 生成</button><button class="primary-btn" data-action="open-asset-form">登记成品</button></div></div><div class="filter-row">${[["all", "全部"], ["image", "图片"], ["video", "视频"], ["copy", "文案"], ["ready", "待发布"]].map(([key, label]) => `<button class="chip-btn ${state.assetFilter === key ? "active" : ""}" data-action="filter-asset" data-filter="${key}">${label}</button>`).join("")}</div><div class="asset-grid">${filtered.length ? filtered.map((item) => renderAssetCard(item)).join("") : `<div class="empty-state"><h3>还没有成品</h3><p class="meta">可以 AI 生成，或手动登记已有成品。</p><div class="button-row"><button class="primary-btn" data-action="open-asset-form">登记成品</button><button class="ghost-btn" data-action="go" data-view="generator">AI 生成</button></div></div>`}</div></div>${renderAssetPreviewPanel()}</section>`;
}

function renderPublish() {
  const failedTasks = publishTasks.filter((item) => item.status === "失败");
  const pendingTasks = publishTasks.filter((item) => ["待发布", "发布中"].includes(item.status));
  if (!state.selectedPublishTaskId && (failedTasks[0] || pendingTasks[0])) {
    state.selectedPublishTaskId = failedTasks[0]?.id || pendingTasks[0]?.id || "";
  }
  const selectedTask = publishTasks.find((item) => item.id === state.selectedPublishTaskId);
  root.innerHTML = `<section class="grid two-col"><div class="panel"><div class="panel-header"><div><h2>商品上架</h2><p>店铺账号 + 平台适配层，支持半自动/自动上架。</p></div><button class="primary-btn" data-action="create-listing">新建上架草稿</button></div><div class="list">${listingTasks.length ? listingTasks.map(renderListingTaskRow).join("") : "<p class='meta'>暂无上架草稿。</p>"}</div></div><div class="panel"><div class="panel-header"><div><h2>内容发布</h2><p>按内容账号排期，走统一平台接口半自动/自动发布。</p></div><button class="primary-btn" data-action="open-publish-form">新建发布任务</button></div><div class="info-grid" style="margin-bottom:14px">${infoBox("待发布", pendingTasks.length)}${infoBox("发布失败", failedTasks.length)}${infoBox("平台异常", platformFailures.filter((item) => item.status === "待处理").length)}</div><div class="list">${publishTasks.length ? publishTasks.map((task) => renderPublishTaskRow(task, true)).join("") : "<p class='meta'>还没有发布任务。</p>"}</div></div></section>${failedTasks.length ? `<section class="panel publish-failures"><div class="panel-header"><div><h2>发布异常队列</h2><p>平台失败原因会进入异常队列，可重试或导出。</p></div></div><div class="list">${failedTasks.map((task) => renderPublishTaskRow(task)).join("")}</div></section>` : ""}${platformFailures.filter((item) => item.status === "待处理").length ? `<section class="panel publish-failures"><div class="panel-header"><div><h2>平台异常队列</h2><p>统一记录各平台 API 失败原因。</p></div></div><div class="list">${platformFailures
    .filter((item) => item.status === "待处理")
    .map(
      (item) =>
        `<article class="task-item"><div><div class="task-title">${escapeHtml(productById(item.productId).name)} / ${escapeHtml(item.platform)}</div><div class="meta">${escapeHtml(item.taskType)} / ${escapeHtml(item.taskId)} / ${escapeHtml(item.capability)}</div><div class="meta task-error">${escapeHtml(item.reason)}</div></div>${statusPill("失败")}</article>`
    )
    .join("")}</div></section>` : ""}<section class="panel"><div class="panel-header"><div><h2>发布日历</h2><p>按账号排期查看待发布任务。</p></div></div><div class="grid three-col">${[["今天", publishTasksBySlot("今天")], ["明天", publishTasksBySlot("明天")], ["本周", publishTasksBySlot("本周")]].map(([day, tasks]) => `<div class="info-box calendar-box"><span>${day}</span><strong>${tasks.length} 个任务</strong><div class="calendar-list">${tasks.slice(0, 4).map((task) => `<div class="meta">${escapeHtml(productById(task.productId).name)} · ${escapeHtml(task.account)} · ${escapeHtml(task.time)}</div>`).join("") || "<p class='meta' style='margin:0'>暂无</p>"}</div></div>`).join("")}</div>${selectedTask ? `<div style="margin-top:14px">${renderPublishTaskRow(selectedTask)}</div>` : ""}</section>${renderPlatformCapabilities()}`;
}

function renderAccounts() {
  root.innerHTML = `<section class="panel"><div class="panel-header"><div><h2>平台账号管理</h2><p>店铺账号负责上架，内容账号负责发布；账号人设影响文案生成风格。</p></div><button class="primary-btn" data-action="open-account-form">绑定账号</button></div><div class="grid three-col">${accounts.map((account) => { const boundProducts = products.filter((item) => item.accounts.includes(account.name)); const todayCount = publishTasks.filter((item) => item.accountId === account.id && item.scheduleSlot === "今天" && ["待发布", "发布中", "已成功"].includes(item.status)).length; return `<article class="account-card"><div class="panel-header"><div><h3>${escapeHtml(account.name)}</h3><p>${escapeHtml(account.platform)} / ${escapeHtml(account.type)}</p></div>${statusPill(account.auth)}</div><div class="info-grid">${infoBox("账号人设", account.persona)}${infoBox("发布规则", account.rule)}${infoBox("绑定商品", boundProducts.length ? boundProducts.map((item) => item.name).join("、") : "暂无")}${infoBox("今天任务", todayCount)}</div></article>`; }).join("")}</div></section>`;
}

function renderInventory() {
  root.innerHTML = `<section class="panel"><div class="panel-header"><div><h2>库存中心</h2><p>库存约束发布与上架；售罄自动暂停，恢复后自动恢复任务。</p></div></div><section class="panel desk-panel" style="margin-bottom:16px"><div class="panel-header"><div><h3>批量导入库存</h3><p>CSV 格式：SKU编号,库存,预警库存（每行一条）</p></div></div><form id="inventoryBatchForm"><label class="field field-wide"><span>粘贴 CSV</span><textarea name="csv" rows="4" placeholder="SKU-CUP-001,186,40&#10;SKU-LIGHT-022,28,35"></textarea></label><div class="button-row"><button class="primary-btn" type="submit">批量导入</button></div></form></section><div class="list">${products.map((product) => { const inventoryStatus = product.stock === 0 ? "售罄" : product.stock <= product.warningStock ? "库存预警" : "库存充足"; const editing = state.inventoryEditingId === product.id; const pausedTasks = publishTasks.filter((item) => item.productId === product.id && item.status === "已暂停").length; return `<article class="inventory-row"><div class="panel-header"><div class="product-cell">${thumb(product)}<div><strong>${product.name}</strong><div class="meta">${product.code} / 预警 ${product.warningStock}</div></div></div>${statusPill(inventoryStatus)}</div><div class="info-grid">${infoBox("当前库存", product.stock)}${infoBox("可售库存", Math.max(product.stock - 6, 0))}${infoBox("暂停任务", pausedTasks)}${infoBox("联动规则", product.stock === 0 ? "禁止发布/上架" : product.stock <= product.warningStock ? "低库存预警" : "正常")}</div>${editing ? `<form class="inventory-edit-form" data-product-id="${product.id}"><label class="field"><span>修改库存</span><input name="stock" type="number" min="0" value="${product.stock}" required /></label><label class="field"><span>预警库存</span><input name="warningStock" type="number" min="0" value="${product.warningStock}" required /></label><div class="button-row"><button class="primary-btn" type="submit">保存库存</button><button class="ghost-btn" type="button" data-action="cancel-inventory-edit">取消</button></div></form>` : `<div class="button-row"><button class="ghost-btn" data-action="edit-inventory" data-id="${product.id}">修改库存</button></div>`}</article>`; }).join("")}</div></section>`;
}

function renderData() {
  const a = state.analytics || buildLocalAnalytics();
  const kindLabel = { image: "图片", copy: "文案", video: "视频" };
  const autoRows = [
    ...(a.automation?.generation || []).map((item) => [
      `${kindLabel[item.kind] || item.kind}生成成功率`,
      item.successRate || 0,
      item.kind === "copy" ? "#6d5bd0" : item.kind === "video" ? "#2563eb" : "#138a54",
    ]),
    ["发布成功率", a.automation?.publishSuccessRate || 0, "#0f9f8f"],
    ["上架成功率", a.automation?.listingSuccessRate || 0, "#b7791f"],
    ["流程成功率", a.automation?.workflowSuccessRate || 0, "#2563eb"],
    ["成品发布转化", a.automation?.assetPublishConversion || 0, "#6d5bd0"],
  ];
  const productRows = (a.products || []).slice(0, 8).map((item) => [
    item.name,
    item.score || 0,
    item.score >= 70 ? "#2563eb" : item.score >= 40 ? "#0f9f8f" : "#b7791f",
  ]);
  const assetRows = (a.assets || [])
    .slice(0, 8)
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.productName)}</td><td>${escapeHtml(item.kind)}</td><td>${item.usageCount || 0}</td><td>${item.publishSuccess || 0}</td><td>${item.successRate || 0}%</td></tr>`
    );
  const accountRows = (a.accounts || [])
    .slice(0, 8)
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.platform)}</td><td>${item.publishCount || 0}</td><td>${item.publishSuccess || 0}</td><td>${item.successRate || 0}%</td></tr>`
    );
  root.innerHTML = `${renderKpis()}${renderStrategySummaryPanel()}${renderTemplateAbPanel()}<section class="panel"><div class="panel-header"><div><h2>优化建议</h2><p>基于当前任务数据，辅助反向优化生成与发布策略。</p></div><button class="ghost-btn" type="button" data-action="refresh-analytics">刷新数据</button></div><ul class="hint-list">${(a.hints || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section><section class="grid two-col"><div class="panel"><div class="panel-header"><div><h2>商品表现</h2><p>综合素材完整度与发布成功率。</p></div></div><div class="bar-chart">${renderBarChartRows(productRows.length ? productRows : [["暂无数据", 0, "#94a3b8"]])}</div></div><div class="panel"><div class="panel-header"><div><h2>自动化数据</h2><p>生成、发布、上架、流程成功率。</p></div></div><div class="bar-chart">${renderBarChartRows(autoRows)}</div></div></section><section class="grid two-col"><div class="panel"><div class="panel-header"><div><h2>成品使用排行</h2><p>哪个成品被用于发布、效果如何。</p></div><button class="ghost-btn" data-action="go" data-view="assets">成品库</button></div>${assetRows.length ? renderDataTable(["成品", "商品", "类型", "使用次数", "发布成功", "成功率"], assetRows) : "<p class='meta'>暂无成品使用记录，发布成功后会自动统计。</p>"}</div><div class="panel"><div class="panel-header"><div><h2>账号发布效果</h2><p>哪个账号发布效果好。</p></div><button class="ghost-btn" data-action="go" data-view="accounts">平台账号</button></div>${accountRows.length ? renderDataTable(["账号", "平台", "发布数", "成功数", "成功率"], accountRows) : "<p class='meta'>暂无账号发布数据。</p>"}</div></section>`;
}

function renderStrategySummaryPanel() {
  const s = state.strategySummary;
  if (!s) {
    return `<section class="panel strategy-overview-panel"><div class="panel-header"><div><h2>策略总览</h2><p>连接本地服务后可查看高表现成品与批量运营机会。</p></div></div></section>`;
  }
  const eligible = (s.productOpportunities || []).filter((item) => item.missingMaterials > 0 || item.score < 80);
  const assetRows = (s.topPerformingAssets || [])
    .slice(0, 5)
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.productName)}</td><td>${escapeHtml(item.kind)}</td><td>${item.usageCount || 0}</td><td>${item.successRate || 0}%</td></tr>`
    );
  const oppRows = (s.productOpportunities || [])
    .slice(0, 8)
    .map(
      (item) =>
        `<tr><td><button class="link-btn" type="button" data-action="go" data-product="${item.productId}">${escapeHtml(item.name)}</button></td><td>${item.score || 0}</td><td>${item.missingMaterials || 0}</td><td>${escapeHtml(item.recommendedTemplate || "—")}</td><td>${escapeHtml(item.topAccount || "—")}</td></tr>`
    );
  return `<section class="panel strategy-overview-panel"><div class="panel-header"><div><h2>策略总览</h2><p>高表现成品识别、账号匹配与批量 SKU 运营机会（M13）。</p></div><button class="ghost-btn" type="button" data-action="refresh-analytics">刷新</button></div><div class="info-grid" style="margin-bottom:14px">${infoBox("商品总数", s.totalProducts || 0)}${infoBox("待补素材", s.productsNeedingMaterials || 0)}${infoBox("可批量启动", eligible.length)}${infoBox("高表现成品", (s.topPerformingAssets || []).length)}</div><div class="batch-workflow-bar"><button class="primary-btn" type="button" data-action="batch-apply-strategy" ${eligible.length ? "" : "disabled"}>批量启动推荐流程（${eligible.length}）</button><span class="meta">按各商品推荐模板自动启动，跳过已在流程中的 SKU。</span></div><section class="grid two-col" style="margin-top:16px"><div><h3 class="section-subtitle">高表现成品</h3>${assetRows.length ? renderDataTable(["成品", "商品", "类型", "使用", "成功率"], assetRows) : "<p class='meta'>发布成功后自动识别高表现成品。</p>"}</div><div><h3 class="section-subtitle">运营机会</h3>${oppRows.length ? renderDataTable(["商品", "得分", "缺素材", "推荐流程", "首选账号"], oppRows) : "<p class='meta'>暂无商品策略数据。</p>"}</div></section></section>`;
}

function renderTemplateAbPanel() {
  const report = state.templateAb;
  if (!report) {
    return `<section class="panel template-ab-panel"><div class="panel-header"><div><h2>模板 A/B 表现</h2><p>连接本地服务后可查看文案类型与人设的效果对比。</p></div></div></section>`;
  }
  const rows = (report.variants || [])
    .slice(0, 8)
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.copyType)}</td><td>${escapeHtml(item.persona)}</td><td>${escapeHtml(item.platform)}</td><td>${item.publishCount || 0}</td><td>${item.successRate || 0}%</td><td>${item.score || 0}</td></tr>`
    );
  return `<section class="panel template-ab-panel"><div class="panel-header"><div><h2>模板 A/B 表现</h2><p>按文案类型、账号人设与平台统计发布成功率，辅助优化生成模板。</p></div></div><ul class="hint-list compact">${(report.hints || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>${rows.length ? renderDataTable(["文案类型", "人设", "平台", "发布数", "成功率", "综合分"], rows) : "<p class='meta'>暂无 A/B 数据，发布成功后会自动累计。</p>"}</section>`;
}

function render() {
  if (state.view === "dashboard") renderDashboard();
  if (state.view === "products") renderProducts();
  if (state.view === "generator") renderGenerator();
  if (state.view === "tasks") renderTasks();
  if (state.view === "workflows") renderWorkflows();
  if (state.view === "publish") renderPublish();
  if (state.view === "assets") renderAssets();
  if (state.view === "accounts") renderAccounts();
  if (state.view === "inventory") renderInventory();
  if (state.view === "data") renderData();
  mountProductCreateModal();
  mountAssetCreateModal();
  mountPublishModal();
  mountAccountModal();
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "stop-propagation") { event.stopPropagation(); return; }
  if (action === "toggle-product-edit") {
    state.productDeskExpanded = !state.productDeskExpanded;
    state.productEditing = state.productDeskExpanded;
    renderProducts();
    return;
  }
  if (action === "open-product-desk") {
    openProductDesk(target.dataset.product, {
      assetId: target.dataset.asset,
      taskId: target.dataset.task,
      workflowId: target.dataset.workflow,
    });
    return;
  }
  if (action === "open-workflows") {
    state.workflowFilter = "failed";
    state.selectedWorkflowId = target.dataset.workflow || "";
    setView("workflows");
    return;
  }
  if (action === "open-publish-failures") {
    state.selectedPublishTaskId = target.dataset.task || "";
    setView("publish");
    return;
  }
  if (action === "open-publish-form") {
    state.publishFormOpen = true;
    if (target.dataset.product) state.selectedProductId = target.dataset.product;
    mountPublishModal();
    return;
  }
  if (action === "close-publish-form") {
    state.publishFormOpen = false;
    mountPublishModal();
    return;
  }
  if (action === "submit-publish-form") {
    const form = document.querySelector("#publishTaskForm");
    if (!form) return;
    const data = new FormData(form);
    const payload = {
      productId: String(data.get("productId") || state.selectedProductId),
      accountId: String(data.get("accountId") || ""),
      scheduleSlot: String(data.get("scheduleSlot") || "今天"),
      scheduleTime: String(data.get("scheduleTime") || "18:00"),
      assetId: String(data.get("assetId") || ""),
      mode: String(data.get("mode") || "半自动"),
      forceLowStock: data.get("forceLowStock") === "1",
    };
    if (API_ENABLED) {
      const ok = await runApiAction("/api/actions/publish-tasks", payload);
      if (ok) {
        state.publishFormOpen = false;
        mountPublishModal();
        showToast("发布任务已创建。");
        setView("publish");
      }
    } else {
      showToast("请连接本地服务后创建发布任务。");
    }
    return;
  }
  if (action === "open-account-form") {
    state.accountFormOpen = true;
    mountAccountModal();
    return;
  }
  if (action === "close-account-form") {
    state.accountFormOpen = false;
    mountAccountModal();
    return;
  }
  if (action === "submit-account-form") {
    const form = document.querySelector("#accountForm");
    if (!form) return;
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    if (API_ENABLED) {
      const ok = await runApiAction("/api/actions/accounts", payload);
      if (ok) {
        state.accountFormOpen = false;
        mountAccountModal();
        showToast("账号已绑定。");
        render();
      }
    } else {
      accounts.unshift({
        id: `AC${String(accounts.length + 1).padStart(3, "0")}`,
        platform: payload.platform || "抖音",
        name: payload.name || "新账号",
        type: payload.type || "内容账号",
        auth: payload.auth || "已授权",
        rule: payload.rule || "每天最多 3 条",
        persona: payload.persona || "通用种草",
      });
      state.accountFormOpen = false;
      mountAccountModal();
      persistState();
      showToast("账号已绑定。");
      render();
    }
    return;
  }
  if (action === "select-publish-task") {
    state.selectedPublishTaskId = target.dataset.id;
    renderPublish();
    return;
  }
  if (action === "execute-publish") {
    if (API_ENABLED) {
      const ok = await runApiAction(`/api/actions/publish-tasks/${target.dataset.id}/execute`, {});
      if (ok) {
        showToast("半自动发布已执行。");
        render();
      }
      return;
    }
    showToast("请连接本地服务后执行发布。");
    return;
  }
  if (action === "retry-publish") {
    if (API_ENABLED) {
      const ok = await runApiAction(`/api/actions/publish-tasks/${target.dataset.id}/retry`, {});
      if (ok) {
        showToast("发布任务已重试。");
        render();
      }
      return;
    }
    showToast("请连接本地服务后重试发布。");
    return;
  }
  if (action === "export-task") {
    try {
      if (API_ENABLED) await downloadPublishExport(target.dataset.id);
      else showToast("请连接本地服务后导出发布包。");
      if (API_ENABLED) showToast("发布包已下载。");
    } catch (error) {
      showToast("导出失败，请稍后重试。");
    }
    return;
  }
  if (action === "filter-workflow") {
    state.workflowFilter = target.dataset.filter;
    state.selectedWorkflowId = "";
    renderWorkflows();
    return;
  }
  if (action === "select-workflow") {
    state.selectedWorkflowId = target.dataset.id;
    renderWorkflows();
    return;
  }
  if (action === "fill-missing-materials") {
    await fillMissingMaterials(target.dataset.product || state.selectedProductId);
    return;
  }
  if (action === "quick-generate") {
    await quickGenerate(target.dataset.product || state.selectedProductId, target.dataset.kind);
    return;
  }
  if (action === "start-workflow") {
    const productId = target.dataset.product || state.selectedProductId;
    const templateSelect = document.querySelector("#deskWorkflowTemplate");
    const template = templateSelect?.value || state.workflowTemplate;
    state.workflowTemplate = template;
    if (API_ENABLED) {
      const ok = await runApiAction("/api/actions/workflows", { productId, template });
      if (ok) {
        syncTaskPolling();
        showToast(`「${template}」流程已启动。`);
        openProductDesk(productId);
      }
      return;
    }
    showToast("请连接本地服务后使用自动化流程。");
    return;
  }
  if (action === "batch-start-auto-ops") {
    const productIds = getEligibleAutoOpsProducts().map((item) => item.id);
    if (!productIds.length) {
      showToast("没有可启动全自动运营的商品。");
      return;
    }
    const multiAccount = document.querySelector("#autoOpsMultiAccount")?.checked !== false;
    const autoExecute = document.querySelector("#autoOpsAutoExecute")?.checked !== false;
    if (API_ENABLED) {
      const ok = await runApiAction("/api/actions/auto-ops/start", {
        productIds,
        template: "全自动运营",
        multiAccount,
        autoExecute,
      });
      if (ok) {
        syncTaskPolling();
        showToast(`已为 ${productIds.length} 个商品启动全自动运营。`);
        renderDashboard();
      }
      return;
    }
    showToast("请连接本地服务后使用全自动运营。");
    return;
  }
  if (action === "batch-start-workflow") {
    const templateSelect = document.querySelector("#batchWorkflowTemplate");
    const template = templateSelect?.value || state.workflowTemplate;
    const productIds = getEligibleBatchProducts().map((item) => item.id);
    if (!productIds.length) {
      showToast("没有可批量启动的商品。");
      return;
    }
    if (API_ENABLED) {
      const ok = await runApiAction("/api/actions/workflows/batch", { productIds, template });
      if (ok) {
        syncTaskPolling();
        showToast(`已为 ${productIds.length} 个商品启动「${template}」。`);
        setView("workflows");
      }
      return;
    }
    showToast("请连接本地服务后使用批量流程。");
    return;
  }
  if (action === "confirm-workflow") {
    const ok = await runApiAction(`/api/actions/workflows/${target.dataset.id}/confirm`, {});
    if (ok) {
      syncTaskPolling();
      showToast("已确认，流程继续执行。");
      render();
    }
    return;
  }
  if (action === "retry-workflow") {
    const ok = await runApiAction(`/api/actions/workflows/${target.dataset.id}/retry`, {});
    if (ok) {
      syncTaskPolling();
      showToast("流程节点已重试。");
      render();
    }
    return;
  }
  if (action === "skip-workflow") {
    const ok = await runApiAction(`/api/actions/workflows/${target.dataset.id}/skip`, {});
    if (ok) {
      syncTaskPolling();
      showToast("已跳过当前节点。");
      render();
    }
    return;
  }
  if (action === "cancel-workflow") {
    const ok = await runApiAction(`/api/actions/workflows/${target.dataset.id}/cancel`, {});
    if (ok) {
      showToast("流程已取消。");
      if (state.selectedWorkflowId === target.dataset.id) state.selectedWorkflowId = "";
      render();
    }
    return;
  }
  if (action === "export-product-pack") {
    try {
      await downloadExportPack(target.dataset.product || state.selectedProductId);
      showToast("素材包已下载。");
    } catch (error) {
      showToast("导出失败，请稍后重试。");
    }
    return;
  }
  if (action === "refresh-analytics") {
    await Promise.all([loadAnalytics(), loadStrategySummary(), loadTemplateAb()]);
    showToast("数据已刷新。");
    if (state.view === "data") renderData();
    return;
  }
  if (action === "add-orchestrator-node") {
    const node = (state.workflowNodeCatalog || []).find((item) => item.key === target.dataset.key);
    if (!node) return;
    state.orchestratorSteps.push({ key: node.key, label: node.label, type: node.type, kind: node.kind || "" });
    renderWorkflows();
    return;
  }
  if (action === "remove-orchestrator-step") {
    const index = Number(target.dataset.index);
    if (Number.isFinite(index)) state.orchestratorSteps.splice(index, 1);
    renderWorkflows();
    return;
  }
  if (action === "move-orchestrator-step") {
    const index = Number(target.dataset.index);
    if (!Number.isFinite(index)) return;
    const dir = target.dataset.dir === "up" ? -1 : 1;
    const next = index + dir;
    if (next < 0 || next >= state.orchestratorSteps.length) return;
    const steps = state.orchestratorSteps;
    [steps[index], steps[next]] = [steps[next], steps[index]];
    renderWorkflows();
    return;
  }
  if (action === "save-custom-workflow") {
    const ok = await saveCustomWorkflowFromForm();
    if (ok) renderWorkflows();
    return;
  }
  if (action === "reset-orchestrator") {
    state.orchestratorSteps = [];
    state.orchestratorEditingId = "";
    renderWorkflows();
    return;
  }
  if (action === "load-custom-workflow") {
    const template = (state.customWorkflowTemplates || []).find((item) => item.id === target.dataset.id);
    if (!template) return;
    state.orchestratorEditingId = template.id;
    state.orchestratorSteps = template.steps.map((step) => ({ ...step }));
    renderWorkflows();
    return;
  }
  if (action === "use-custom-workflow") {
    state.workflowTemplate = target.dataset.name || state.workflowTemplate;
    showToast(`已选用「${state.workflowTemplate}」，可在批量启动或商品运营台使用。`);
    renderWorkflows();
    return;
  }
  if (action === "delete-custom-workflow") {
    if (!API_ENABLED) {
      showToast("请连接本地服务后删除自定义流程。");
      return;
    }
    try {
      const response = await fetch(`/api/workflows/custom-templates/${target.dataset.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Delete failed");
      if (state.orchestratorEditingId === target.dataset.id) {
        state.orchestratorEditingId = "";
        state.orchestratorSteps = [];
      }
      showToast("自定义流程已删除。");
      await Promise.all([loadWorkflowOrchestratorData(), loadWorkflowTemplates()]);
      renderWorkflows();
    } catch (error) {
      showToast(error.message || "删除失败。");
    }
    return;
  }
  if (action === "refresh-strategy") {
    const productId = target.dataset.product || state.selectedProductId;
    await loadProductStrategy(productId);
    showToast("策略已刷新。");
    if (state.view === "products") renderProducts();
    return;
  }
  if (action === "apply-strategy") {
    const productId = target.dataset.product || state.selectedProductId;
    const payload = {
      productId,
      action: target.dataset.strategy,
      assetId: target.dataset.asset || undefined,
    };
    if (!API_ENABLED) {
      showToast("请连接本地服务后使用智能策略。");
      return;
    }
    const ok = await runApiAction("/api/actions/strategy/apply", payload);
    if (ok) {
      syncTaskPolling();
      const msg =
        payload.action === "set-recommended-primary"
          ? "已采纳推荐主图。"
          : payload.action === "start-differentiated-copy"
            ? "差异化文案生成已启动。"
            : "推荐流程已启动。";
      showToast(msg);
      await loadProductStrategy(productId);
      if (state.view === "products") renderProducts();
      else render();
    }
    return;
  }
  if (action === "batch-apply-strategy") {
    if (!API_ENABLED) {
      showToast("请连接本地服务后使用批量策略。");
      return;
    }
    const ok = await runApiAction("/api/actions/strategy/batch-apply", {
      action: "start-recommended-workflows",
      multiAccount: true,
      autoExecute: true,
    });
    if (ok) {
      syncTaskPolling();
      showToast("已按推荐模板批量启动流程。");
      await loadStrategySummary();
      if (state.view === "data") renderData();
      else setView("workflows");
    }
    return;
  }
  if (action === "go") {
    if (target.dataset.view) setView(target.dataset.view);
    else if (target.dataset.product) openProductDesk(target.dataset.product);
    return;
  }
  if (action === "execute-listing") {
    if (API_ENABLED) {
      const ok = await runApiAction(`/api/actions/listing-tasks/${target.dataset.id}/execute`, {});
      if (ok) {
        showToast("平台上架已执行。");
        render();
      }
      return;
    }
    showToast("请连接本地服务后执行上架。");
    return;
  }
  if (action === "retry-listing") {
    if (API_ENABLED) {
      const ok = await runApiAction(`/api/actions/listing-tasks/${target.dataset.id}/retry`, {});
      if (ok) {
        showToast("上架任务已重试。");
        render();
      }
      return;
    }
    showToast("请连接本地服务后重试。");
    return;
  }
  if (action === "open-product-form") { state.productFormOpen = true; mountProductCreateModal(); return; }
  if (action === "close-product-form") { state.productFormOpen = false; mountProductCreateModal(); return; }
  if (action === "open-asset-form") { state.assetFormOpen = true; mountAssetCreateModal(); return; }
  if (action === "close-asset-form") { state.assetFormOpen = false; mountAssetCreateModal(); return; }
  if (action === "start-product-edit") { state.productEditing = true; renderProducts(); return; }
  if (action === "cancel-product-edit") { state.productEditing = false; renderProducts(); return; }
  if (action === "edit-inventory") { state.inventoryEditingId = target.dataset.id; renderInventory(); return; }
  if (action === "cancel-inventory-edit") { state.inventoryEditingId = ""; renderInventory(); return; }
  if (action === "filter-asset") {
    state.assetFilter = target.dataset.filter;
    if (state.view === "assets") renderAssets();
    else renderProducts();
    return;
  }
  if (action === "preview-asset") {
    const asset = assetById(target.dataset.id);
    if (asset) openProductDesk(asset.productId, { assetId: asset.id });
    else {
      state.selectedAssetId = target.dataset.id;
      if (state.view !== "assets") openProductDesk(state.selectedProductId, { assetId: target.dataset.id });
      else renderAssets();
    }
    return;
  }
  if (action === "publish-asset") {
    const ok = await publishAsset(target.dataset.id);
    if (ok) {
      showToast("发布任务已创建。");
      render();
    }
    return;
  }
  if (action === "select-product") { state.selectedProductId = target.dataset.id; state.productEditing = false; setView("products"); return; }
  if (action === "filter-product") { state.productFilter = target.dataset.status; renderProducts(); return; }
  if (action === "generator-tab") { state.activeGenerator = target.dataset.tab; if (state.view === "generator") renderGenerator(); else renderProducts(); return; }
  if (action === "run-generator") {
    const product = productById(state.selectedProductId);
    const formParams = document.querySelector("#generatorForm") ? readGeneratorForm() : defaultGenerationParams(state.activeGenerator, product);
    const payload = { productId: state.selectedProductId, kind: state.activeGenerator, ...formParams };
    if (API_ENABLED) {
      const ok = await runApiAction("/api/actions/generate", payload);
      if (ok) {
        syncTaskPolling();
        showToast(`${GENERATION_KIND_LABEL[state.activeGenerator] || "生成"}任务已创建。`);
        if (state.view === "generator") renderGenerator();
        else renderProducts();
      }
      return;
    }
    createLocalGenerationTask(state.selectedProductId, state.activeGenerator, formParams);
    showToast(`${GENERATION_KIND_LABEL[state.activeGenerator] || "生成"}任务已创建。`);
    if (state.view === "generator") renderGenerator();
    else renderProducts();
    return;
  }
  if (action === "start-asset-edit") {
    state.assetEditing = true;
    render();
    return;
  }
  if (action === "cancel-asset-edit") {
    state.assetEditing = false;
    render();
    return;
  }
  if (action === "select-copy-variant") {
    await saveAssetContent(target.dataset.id, { selectedVariant: Number(target.dataset.index) });
    state.selectedAssetId = target.dataset.id;
    render();
    return;
  }
  if (action === "set-primary-image") {
    if (API_ENABLED) {
      const ok = await runApiAction(`/api/actions/assets/${target.dataset.id}/set-primary`, {});
      if (ok) {
        showToast("已设为主图。");
        render();
      }
      return;
    }
    const asset = assetById(target.dataset.id);
    if (!asset) return;
    assets.forEach((item) => {
      if (item.productId === asset.productId && item.kind === "image") item.isPrimary = item.id === asset.id;
    });
    persistState();
    showToast("已设为主图。");
    render();
    return;
  }
  if (action === "select-task") {
    state.selectedTaskId = target.dataset.id;
    const task = taskById(state.selectedTaskId);
    if (task && state.view !== "tasks") openProductDesk(task.productId, { taskId: task.id });
    else if (state.view === "tasks") renderTasks();
    else renderProducts();
    return;
  }
  if (action === "retry-generation") {
    const taskId = target.dataset.id;
    if (API_ENABLED) {
      const ok = await runApiAction(`/api/actions/generation-tasks/${taskId}/retry`, {});
      if (ok) {
        syncTaskPolling();
        showToast("任务已重新排队。");
        render();
      }
      return;
    }
    if (retryLocalGenerationTask(taskId)) {
      showToast("任务已重新排队。");
      render();
    }
    return;
  }
  if (action === "create-publish") {
    state.publishFormOpen = true;
    if (target.dataset.product) state.selectedProductId = target.dataset.product;
    mountPublishModal();
    return;
  }
  if (action === "create-listing") {
    const productId = target.dataset.product || state.selectedProductId;
    const product = productById(productId);
    if (API_ENABLED) {
      const ok = await runApiAction("/api/actions/listing-tasks", { productId: product.id });
      if (ok) {
        showToast("上架草稿已创建。");
        if (state.view === "products") renderProducts();
        else renderPublish();
      }
      return;
    }
    const completeness = computeLocalListingCompleteness(product);
    listingTasks.unshift({
      id: `L${String(listingTasks.length + 1).padStart(3, "0")}`,
      productId: product.id,
      platform: product.platforms[0] || "待选择",
      account: product.accounts[0] || "未绑定",
      status: product.stock === 0 ? "库存拦截" : completeness >= 80 ? "草稿中" : "待补充",
      completeness,
      missing: [],
    });
    product.listingStatus = product.stock === 0 ? "库存拦截" : completeness >= 80 ? "草稿中" : "待补充";
    logs.unshift({ productId: product.id, text: "已创建上架草稿", time: "刚刚", action: "general" });
    persistState();
    showToast("上架草稿已创建。");
    if (state.view === "products") renderProducts();
    else renderPublish();
    return;
  }
  if (action === "save-template") showToast("MVP 已记录该操作入口，后续接入真实服务。");
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (event.target.id === "editAssetForm") {
    try {
      const content = String(new FormData(event.target).get("content") || "").trim();
      const ok = await saveAssetContent(state.selectedAssetId, { content });
      if (!ok) throw new Error("Update failed");
      state.assetEditing = false;
      showToast("文案已保存。");
      render();
    } catch (error) {
      showToast("文案保存失败，请重试。");
    }
    return;
  }
  if (event.target.id === "createProductForm") {
    try {
      const payload = readProductForm(event.target);
      const productId = await createProduct(payload);
      if (!productId) throw new Error("Create failed");
      state.productFormOpen = false;
      state.selectedProductId = productId;
      state.productEditing = false;
      mountProductCreateModal();
      showToast(payload.autoStart ? `商品「${payload.name || "未命名商品"}」已创建，全自动流程已启动。` : `商品「${payload.name || "未命名商品"}」已创建。`);
      setView("products");
    } catch (error) { showToast("商品创建失败，请检查表单后重试。"); }
    return;
  }
  if (event.target.id === "editProductForm") {
    try {
      const ok = await saveProduct(state.selectedProductId, readProductForm(event.target));
      if (!ok) throw new Error("Update failed");
      state.productEditing = false;
      showToast("商品资料已保存。");
      renderProducts();
    } catch (error) { showToast("商品保存失败，请检查表单后重试。"); }
    return;
  }
  if (event.target.id === "createAssetForm") {
    try {
      const data = new FormData(event.target);
      await registerAsset({
        productId: String(data.get("productId")),
        name: String(data.get("name") || "").trim(),
        kind: String(data.get("kind") || "image"),
        type: String(data.get("type") || "主图"),
        content: String(data.get("content") || "").trim(),
      });
      state.assetFormOpen = false;
      mountAssetCreateModal();
      showToast("成品已登记保存。");
      openProductDesk(String(data.get("productId")));
    } catch (error) { showToast("成品登记失败，请检查表单后重试。"); }
    return;
  }
  if (event.target.id === "inventoryBatchForm") {
    event.preventDefault();
    const csv = String(new FormData(event.target).get("csv") || "").trim();
    if (!csv) {
      showToast("请粘贴 CSV 数据。");
      return;
    }
    if (API_ENABLED) {
      const ok = await runApiAction("/api/actions/inventory/batch-import", { csv });
      if (ok) {
        showToast("库存批量导入完成。");
        renderInventory();
      }
      return;
    }
    showToast("请连接本地服务后批量导入。");
    return;
  }
  if (event.target.matches(".inventory-edit-form")) {
    try {
      const formData = new FormData(event.target);
      const ok = await saveProduct(event.target.dataset.productId, { stock: Number(formData.get("stock")), warningStock: Number(formData.get("warningStock")) });
      if (!ok) throw new Error("Inventory update failed");
      state.inventoryEditingId = "";
      showToast("库存已保存。");
      renderInventory();
    } catch (error) { showToast("库存保存失败，请重试。"); }
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-action='choose-product']")) {
    state.selectedProductId = event.target.value;
    if (state.view === "generator") renderGenerator();
    else renderProducts();
    return;
  }
  if (event.target.matches("[data-action='asset-kind-change']")) {
    const kind = event.target.value;
    const typeSelect = document.querySelector("#assetTypeSelect");
    const contentField = event.target.closest("form")?.querySelector("[name='content']")?.closest(".field");
    if (typeSelect) typeSelect.innerHTML = ASSET_TYPE_BY_KIND[kind].map((item) => `<option value="${item}">${item}</option>`).join("");
    if (contentField) contentField.classList.toggle("hidden-field", kind !== "copy");
  }
});

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));

async function initApp() {
  await loadRemoteState();
  await loadWorkflowTemplates();
  await loadPlatformCapabilities();
  await loadAnalytics();
  await loadCopyProvider();
  renderTopActions();
  render();
}

initApp();
