const state = {
  view: "dashboard",
  activeGenerator: "image",
  selectedProductId: "P1001",
  selectedReviewId: "R001",
  productFilter: "all",
};

const products = [
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
    status: "待审核",
    imageStatus: "待审核",
    copyStatus: "审核通过",
    videoStatus: "生成成功",
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
    imageStatus: "生成成功",
    copyStatus: "生成成功",
    videoStatus: "待生成",
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
    imageStatus: "审核通过",
    copyStatus: "审核通过",
    videoStatus: "已加入发布",
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
    copyStatus: "待审核",
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

const workflows = [
  { productId: "P1001", product: "智能恒温杯", node: "等待素材审核", status: "待审核", progress: 68 },
  { productId: "P1004", product: "低糖燕麦能量棒", node: "正在生成视频", status: "生成中", progress: 54 },
  { productId: "P1002", product: "折叠补光灯", node: "库存低于预警值", status: "异常", progress: 42 },
  { productId: "P1003", product: "旅行压缩收纳包", node: "库存为 0，发布已暂停", status: "已暂停", progress: 76 },
];

const assets = [
  { id: "A001", productId: "P1001", name: "恒温杯主图 A", type: "主图", status: "待审核", usage: "上架草稿", version: "v3", kind: "image" },
  { id: "A002", productId: "P1001", name: "恒温杯种草视频", type: "短视频", status: "待审核", usage: "发布任务", version: "v2", kind: "video" },
  { id: "A003", productId: "P1002", name: "补光灯详情页图", type: "详情页图", status: "审核通过", usage: "素材库", version: "v1", kind: "image" },
  { id: "A004", productId: "P1003", name: "收纳包卖点图", type: "卖点图", status: "审核通过", usage: "已上架", version: "v4", kind: "image" },
  { id: "A005", productId: "P1004", name: "燕麦棒发布文案", type: "发布文案", status: "待审核", usage: "待发布", version: "v1", kind: "copy" },
];

const reviews = [
  { id: "R001", productId: "P1001", target: "恒温杯主图 A", type: "图片", status: "待审核", reviewer: "运营审核", reason: "确认主图是否符合抖音上架规范" },
  { id: "R002", productId: "P1001", target: "恒温杯种草视频", type: "视频", status: "待审核", reviewer: "内容审核", reason: "确认视频脚本、封面和挂商品信息" },
  { id: "R003", productId: "P1004", target: "燕麦棒发布文案", type: "文案", status: "待审核", reviewer: "内容审核", reason: "检查低糖表达和平台敏感词" },
];

const listingTasks = [
  { id: "L001", productId: "P1001", platform: "抖音", account: "抖店主账号", status: "草稿中", completeness: 86 },
  { id: "L002", productId: "P1004", platform: "小红书", account: "小红书店铺", status: "待审核", completeness: 74 },
  { id: "L003", productId: "P1003", platform: "淘宝", account: "淘宝店铺", status: "已上架", completeness: 100 },
];

const publishTasks = [
  { id: "PUB001", productId: "P1001", platform: "小红书", account: "小红书种草号", status: "待发布", time: "今天 18:30", attachProduct: true },
  { id: "PUB002", productId: "P1002", platform: "视频号", account: "测评号 B", status: "待素材", time: "明天 10:00", attachProduct: false },
  { id: "PUB003", productId: "P1003", platform: "抖音", account: "促销号 C", status: "已暂停", time: "库存恢复后", attachProduct: true },
];

const accounts = [
  { id: "AC001", platform: "抖音", name: "抖店主账号", type: "店铺账号", auth: "已授权", rule: "上架前必须审核", persona: "商品管理" },
  { id: "AC002", platform: "抖音", name: "抖音内容号 A", type: "内容账号", auth: "已授权", rule: "每天最多 3 条", persona: "种草展示" },
  { id: "AC003", platform: "小红书", name: "小红书种草号", type: "内容账号", auth: "已授权", rule: "发布前必须审核", persona: "生活方式种草" },
  { id: "AC004", platform: "视频号", name: "测评号 B", type: "内容账号", auth: "授权即将过期", rule: "失败后重试 1 次", persona: "测评讲解" },
];

const logs = [
  { productId: "P1001", text: "AI 图片生成完成，新增 4 个主图版本", time: "15:20" },
  { productId: "P1001", text: "生成发布文案 6 版，种草版已加入审核", time: "15:08" },
  { productId: "P1004", text: "视频生成任务进入 Running 状态", time: "14:55" },
  { productId: "P1003", text: "库存为 0，系统暂停 3 个待发布任务", time: "11:42" },
];

const titles = {
  dashboard: "首页工作台",
  products: "商品中心",
  generator: "AI 生成工作台",
  review: "审核中心",
  publish: "上架与发布中心",
  assets: "素材库",
  accounts: "平台账号管理",
  inventory: "库存中心",
  data: "数据中心",
};

const root = document.querySelector("#viewRoot");
const pageTitle = document.querySelector("#pageTitle");
const toast = document.querySelector("#toast");

function productById(id) {
  return products.find((item) => item.id === id) || products[0];
}

function statusClass(status) {
  if (["审核通过", "已上架", "已发布", "生成成功", "已授权", "库存充足"].includes(status)) return "green";
  if (["待审核", "待发布", "草稿中", "待生成", "待素材"].includes(status)) return "blue";
  if (["库存预警", "授权即将过期", "生成中", "平台审核中"].includes(status)) return "amber";
  if (["异常", "生成失败", "发布失败", "已暂停", "库存不足", "售罄"].includes(status)) return "red";
  return "violet";
}

function statusPill(status) {
  return `<span class="status ${statusClass(status)}">${status}</span>`;
}

function thumb(product, className = "thumb") {
  return `<div class="${className}" style="--c1:${product.colors[0]};--c2:${product.colors[1]}"></div>`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function setView(view) {
  state.view = view;
  pageTitle.textContent = titles[view];
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  render();
}

function renderKpis() {
  const pendingReview = reviews.filter((item) => item.status === "待审核").length;
  const lowStock = products.filter((item) => item.stock <= item.warningStock).length;
  const pendingPublish = publishTasks.filter((item) => item.status === "待发布").length;
  const running = workflows.filter((item) => item.status === "生成中").length;
  return `
    <section class="grid kpi-grid">
      ${kpi("待审核素材", pendingReview, "图片、视频、文案等待确认", "#2563eb")}
      ${kpi("生成中任务", running, "图片和视频异步生成中", "#0f9f8f")}
      ${kpi("待发布内容", pendingPublish, "已排期或待确认发布", "#6d5bd0")}
      ${kpi("库存预警商品", lowStock, "低库存会拦截发布", "#b7791f")}
    </section>
  `;
}

function kpi(label, value, note, color) {
  return `
    <article class="kpi-card" style="--accent:${color}">
      <span class="kpi-label">${label}</span>
      <strong class="kpi-value">${value}</strong>
      <p class="kpi-note">${note}</p>
    </article>
  `;
}

function renderDashboard() {
  root.innerHTML = `
    ${renderKpis()}
    <section class="grid two-col">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>自动化流程状态</h2>
            <p>每个商品都显示当前节点，后续可接真实工作流执行器。</p>
          </div>
          <button class="ghost-btn" data-action="go" data-view="products">查看商品</button>
        </div>
        <div class="list">
          ${workflows.map(renderWorkflowItem).join("")}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>今日处理队列</h2>
            <p>优先处理审核、库存和发布异常。</p>
          </div>
        </div>
        <div class="list">
          ${reviews.map(renderReviewMini).join("")}
          ${products.filter((item) => item.stock <= item.warningStock).map(renderStockMini).join("")}
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>商品运营概览</h2>
          <p>一眼看到商品卡在哪一步。</p>
        </div>
        <div class="inline-actions">
          <button class="ghost-btn" data-action="go" data-view="generator">生成图文视频</button>
          <button class="primary-btn" data-action="go" data-view="review">进入审核</button>
        </div>
      </div>
      ${renderProductTable(products)}
    </section>
  `;
}

function renderWorkflowItem(item) {
  return `
    <article class="task-item">
      <div>
        <div class="task-title">${item.product}</div>
        <div class="meta">${item.node}</div>
        <div class="progress" aria-label="流程进度"><span style="--value:${item.progress}%"></span></div>
      </div>
      <div>${statusPill(item.status)}</div>
    </article>
  `;
}

function renderReviewMini(item) {
  const product = productById(item.productId);
  return `
    <article class="task-item">
      <div>
        <div class="task-title">${item.target}</div>
        <div class="meta">${product.name} / ${item.type} / ${item.reason}</div>
      </div>
      <button class="small-btn" data-action="open-review" data-id="${item.id}">处理</button>
    </article>
  `;
}

function renderStockMini(product) {
  return `
    <article class="task-item">
      <div>
        <div class="task-title">${product.name}</div>
        <div class="meta">当前库存 ${product.stock}，预警库存 ${product.warningStock}</div>
      </div>
      ${statusPill(product.stock === 0 ? "售罄" : "库存预警")}
    </article>
  `;
}

function renderProductTable(items) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>商品</th>
            <th>类目</th>
            <th>库存</th>
            <th>图片</th>
            <th>文案</th>
            <th>视频</th>
            <th>上架</th>
            <th>发布</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((product) => `
            <tr>
              <td>
                <div class="product-cell">
                  ${thumb(product)}
                  <div>
                    <strong>${product.name}</strong>
                    <div class="meta">${product.code}</div>
                  </div>
                </div>
              </td>
              <td>${product.category}</td>
              <td>${product.stock}</td>
              <td>${statusPill(product.imageStatus)}</td>
              <td>${statusPill(product.copyStatus)}</td>
              <td>${statusPill(product.videoStatus)}</td>
              <td>${statusPill(product.listingStatus)}</td>
              <td>${statusPill(product.publishStatus)}</td>
              <td><button class="small-btn" data-action="select-product" data-id="${product.id}">详情</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderProducts() {
  const filtered = state.productFilter === "all"
    ? products
    : products.filter((product) => product.status === state.productFilter);
  const product = productById(state.selectedProductId);
  const productAssets = assets.filter((item) => item.productId === product.id);
  const productLogs = logs.filter((item) => item.productId === product.id);

  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>商品列表</h2>
          <p>商品是系统所有生成、审核、发布和库存联动的中心。</p>
        </div>
        <div class="inline-actions">
          <button class="ghost-btn" data-action="mock-create">弱信息新建</button>
          <button class="primary-btn" data-action="go" data-view="generator">发起生成</button>
        </div>
      </div>
      <div class="filter-row">
        ${["all", "待审核", "生成中", "库存预警", "已暂停"].map((status) => `
          <button class="chip-btn ${state.productFilter === status ? "active" : ""}" data-action="filter-product" data-status="${status}">
            ${status === "all" ? "全部" : status}
          </button>
        `).join("")}
      </div>
      ${renderProductTable(filtered)}
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>商品运营档案</h2>
          <p>${product.name} 的素材、任务、上架、发布、库存和日志。</p>
        </div>
        <div class="inline-actions">
          <button class="ghost-btn" data-action="create-review" data-product="${product.id}">提交审核</button>
          <button class="primary-btn" data-action="create-publish" data-product="${product.id}">创建发布任务</button>
        </div>
      </div>

      <div class="detail-layout">
        <div class="detail-hero">
          ${thumb(product, "large-thumb")}
          <div class="info-grid">
            ${infoBox("商品编号", product.code)}
            ${infoBox("类目", product.category)}
            ${infoBox("价格", `¥${product.price}`)}
            ${infoBox("目标平台", product.platforms.join("、"))}
            ${infoBox("绑定账号", product.accounts.join("、"))}
            ${infoBox("商品状态", statusPill(product.status))}
          </div>
        </div>

        <div class="grid">
          <div class="panel">
            <h3>基础资料</h3>
            <p class="meta">卖点：${product.sellingPoints}</p>
            <p class="meta">规格：${product.specs}</p>
            <div class="progress"><span style="--value:${product.progress}%"></span></div>
          </div>

          <div class="panel">
            <h3>素材版本</h3>
            <div class="asset-grid">
              ${productAssets.map(renderAssetCard).join("") || "<p class='meta'>暂无素材。</p>"}
            </div>
          </div>

          <div class="panel">
            <h3>操作日志</h3>
            <div class="timeline">
              ${productLogs.map(renderLog).join("") || "<p class='meta'>暂无日志。</p>"}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function infoBox(label, value) {
  return `<div class="info-box"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderLog(log) {
  return `<div class="log-item"><span class="dot"></span><div><strong>${log.text}</strong><div class="meta">${log.time}</div></div></div>`;
}

function renderGenerator() {
  const product = productById(state.selectedProductId);
  root.innerHTML = `
    <section class="grid two-col">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>AI 生成工作台</h2>
            <p>前台只暴露生成能力，底层后续接 RunningHub 图片和视频工作流。</p>
          </div>
        </div>

        <div class="tabs">
          ${[
            ["image", "图片生成"],
            ["copy", "文案生成"],
            ["video", "视频生成"],
          ].map(([key, label]) => `<button class="tab-btn ${state.activeGenerator === key ? "active" : ""}" data-action="generator-tab" data-tab="${key}">${label}</button>`).join("")}
        </div>

        <div class="form-grid">
          <label class="field">
            <span>选择商品</span>
            <select data-action="choose-product">
              ${products.map((item) => `<option value="${item.id}" ${item.id === product.id ? "selected" : ""}>${item.name}</option>`).join("")}
            </select>
          </label>
          ${renderGeneratorFields()}
        </div>

        <div class="button-row" style="margin-top:14px">
          <button class="primary-btn" data-action="run-generator">开始生成</button>
          <button class="ghost-btn" data-action="save-template">保存为默认模板</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>当前商品上下文</h2>
            <p>生成输入自动读取商品资料，用户可追加要求。</p>
          </div>
          ${statusPill(product.status)}
        </div>
        ${thumb(product, "large-thumb")}
        <div class="info-grid" style="margin-top:14px">
          ${infoBox("商品", product.name)}
          ${infoBox("类目", product.category)}
          ${infoBox("库存", product.stock)}
          ${infoBox("卖点", product.sellingPoints)}
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>最近生成结果</h2>
          <p>生成结果不覆盖旧素材，统一进入素材库并形成版本。</p>
        </div>
      </div>
      <div class="result-grid">
        ${assets.slice(0, 6).map(renderAssetCard).join("")}
      </div>
    </section>
  `;
}

function renderGeneratorFields() {
  if (state.activeGenerator === "image") {
    return `
      <label class="field"><span>图片类型</span><select><option>商品主图</option><option>详情页图</option><option>卖点图</option><option>视频封面</option></select></label>
      <label class="field"><span>输出尺寸</span><select><option>1:1 平台主图</option><option>3:4 小红书</option><option>16:9 视频封面</option></select></label>
      <label class="field"><span>生成数量</span><select><option>4 张</option><option>6 张</option><option>8 张</option></select></label>
      <label class="field"><span>风格要求</span><textarea>真实商品质感，干净背景，突出核心卖点。</textarea></label>
    `;
  }
  if (state.activeGenerator === "copy") {
    return `
      <label class="field"><span>文案类型</span><select><option>商品标题</option><option>核心卖点</option><option>详情页文案</option><option>发布文案</option><option>视频脚本</option></select></label>
      <label class="field"><span>目标平台</span><select><option>抖音</option><option>小红书</option><option>淘宝</option><option>视频号</option></select></label>
      <label class="field"><span>生成版本</span><select><option>标准、种草、促销、搜索</option><option>口播、测评、简短</option></select></label>
      <label class="field"><span>额外要求</span><textarea>不要夸大宣传，强调使用场景和购买理由。</textarea></label>
    `;
  }
  return `
    <label class="field"><span>视频类型</span><select><option>商品展示视频</option><option>图文混剪视频</option><option>商品讲解视频</option><option>促销视频</option></select></label>
    <label class="field"><span>视频比例</span><select><option>9:16 竖版</option><option>1:1 方版</option><option>16:9 横版</option></select></label>
    <label class="field"><span>时长</span><select><option>15 秒</option><option>30 秒</option><option>45 秒</option></select></label>
    <label class="field"><span>脚本确认</span><textarea>先生成脚本并进入确认，再调用视频生成，降低生成成本。</textarea></label>
  `;
}

function renderAssetCard(asset) {
  const product = productById(asset.productId);
  const previewClass = asset.kind === "video" ? "asset-preview video" : "asset-preview";
  return `
    <article class="asset-card">
      <div class="${previewClass}" style="--c1:${product.colors[0]};--c2:${product.colors[1]}"></div>
      <div>
        <strong>${asset.name}</strong>
        <div class="meta">${product.name} / ${asset.type} / ${asset.version}</div>
      </div>
      <div class="inline-actions">
        ${statusPill(asset.status)}
        <button class="small-btn" data-action="asset-review" data-id="${asset.id}">加入审核</button>
      </div>
    </article>
  `;
}

function renderReview() {
  const selected = reviews.find((item) => item.id === state.selectedReviewId) || reviews[0];
  const product = productById(selected.productId);
  root.innerHTML = `
    <section class="review-layout">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>审核队列</h2>
            <p>自动化流程在关键节点暂停，审核通过后继续。</p>
          </div>
        </div>
        <div class="list">
          ${reviews.map((item) => `
            <button class="review-card ${item.id === selected.id ? "active" : ""}" data-action="choose-review" data-id="${item.id}">
              <div class="task-title">${item.target}</div>
              <div class="meta">${productById(item.productId).name} / ${item.type}</div>
              ${statusPill(item.status)}
            </button>
          `).join("") || "<p class='meta'>暂无待审核内容。</p>"}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>${selected.target}</h2>
            <p>${selected.reason}</p>
          </div>
          ${statusPill(selected.status)}
        </div>

        <div class="compare-grid">
          <div class="compare-box">
            <h3>原始商品资料</h3>
            ${thumb(product, "large-thumb")}
            <p class="meta" style="margin-top:12px">商品：${product.name}</p>
            <p class="meta">卖点：${product.sellingPoints}</p>
            <p class="meta">规格：${product.specs}</p>
          </div>
          <div class="compare-box">
            <h3>AI 生成结果</h3>
            ${selected.type === "文案" ? `<div class="copy-box">低糖不寡淡，独立小包装更适合通勤、健身和办公室加餐。突出高纤、轻负担与场景化购买理由。</div>` : thumb(product, "large-thumb")}
            <p class="meta" style="margin-top:12px">目标平台：${product.platforms.join("、")}</p>
            <p class="meta">处理人：${selected.reviewer}</p>
          </div>
        </div>

        <div class="button-row" style="margin-top:16px">
          <button class="primary-btn" data-action="approve-review" data-id="${selected.id}">审核通过</button>
          <button class="ghost-btn" data-action="change-approve" data-id="${selected.id}">修改后通过</button>
          <button class="ghost-btn" data-action="regen-review" data-id="${selected.id}">要求重新生成</button>
          <button class="danger-btn" data-action="reject-review" data-id="${selected.id}">驳回</button>
        </div>
      </div>
    </section>
  `;
}

function renderPublish() {
  root.innerHTML = `
    <section class="grid two-col">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>商品上架</h2>
            <p>第一版先做上架草稿和字段完整性检查。</p>
          </div>
          <button class="primary-btn" data-action="create-listing">新建上架草稿</button>
        </div>
        <div class="list">
          ${listingTasks.map((task) => {
            const product = productById(task.productId);
            return `
              <article class="task-item">
                <div>
                  <div class="task-title">${product.name} / ${task.platform}</div>
                  <div class="meta">${task.account} / 字段完整度 ${task.completeness}%</div>
                  <div class="progress"><span style="--value:${task.completeness}%"></span></div>
                </div>
                ${statusPill(task.status)}
              </article>
            `;
          }).join("")}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>内容发布</h2>
            <p>支持自动、半自动、导出发布三种路径的任务结构。</p>
          </div>
          <button class="primary-btn" data-action="create-publish">新建发布任务</button>
        </div>
        <div class="list">
          ${publishTasks.map((task) => {
            const product = productById(task.productId);
            return `
              <article class="task-item">
                <div>
                  <div class="task-title">${product.name} / ${task.platform}</div>
                  <div class="meta">${task.account} / ${task.time} / ${task.attachProduct ? "挂商品" : "不挂商品"}</div>
                </div>
                <div class="inline-actions">
                  ${statusPill(task.status)}
                  <button class="small-btn" data-action="export-task" data-id="${task.id}">导出</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>发布日历</h2>
          <p>MVP 先展示计划，后续支持拖动改期、批量暂停和重新发布。</p>
        </div>
      </div>
      <div class="grid three-col">
        ${["今天", "明天", "本周"].map((day) => `
          <div class="info-box">
            <span>${day}</span>
            <strong>${publishTasks.filter((task) => task.time.includes(day) || (day === "本周" && task.status === "已暂停")).length} 个任务</strong>
            <p class="meta" style="margin-bottom:0">待发布、暂停和导出任务集中处理。</p>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAssets() {
  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>商品运营素材库</h2>
          <p>素材绑定商品、平台、账号、版本、审核状态和使用状态。</p>
        </div>
        <button class="primary-btn" data-action="go" data-view="generator">生成新素材</button>
      </div>
      <div class="filter-row">
        <button class="chip-btn active">全部</button>
        <button class="chip-btn">图片</button>
        <button class="chip-btn">视频</button>
        <button class="chip-btn">文案</button>
        <button class="chip-btn">待审核</button>
      </div>
      <div class="asset-grid">
        ${assets.map(renderAssetCard).join("")}
      </div>
    </section>
  `;
}

function renderAccounts() {
  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>平台账号管理</h2>
          <p>店铺账号负责上架，内容账号负责发布，账号人设影响生成内容。</p>
        </div>
        <button class="primary-btn" data-action="mock-account">绑定账号</button>
      </div>
      <div class="grid three-col">
        ${accounts.map((account) => `
          <article class="account-card">
            <div class="panel-header">
              <div>
                <h3>${account.name}</h3>
                <p>${account.platform} / ${account.type}</p>
              </div>
              ${statusPill(account.auth)}
            </div>
            <div class="info-grid">
              ${infoBox("账号人设", account.persona)}
              ${infoBox("发布规则", account.rule)}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderInventory() {
  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>简易库存中心</h2>
          <p>库存会影响上架、发布和自动化流程。</p>
        </div>
        <button class="primary-btn" data-action="sync-stock">同步库存</button>
      </div>
      <div class="list">
        ${products.map((product) => {
          const inventoryStatus = product.stock === 0 ? "售罄" : product.stock <= product.warningStock ? "库存预警" : "库存充足";
          return `
            <article class="inventory-row">
              <div class="panel-header">
                <div class="product-cell">
                  ${thumb(product)}
                  <div>
                    <strong>${product.name}</strong>
                    <div class="meta">${product.code} / 预警 ${product.warningStock}</div>
                  </div>
                </div>
                ${statusPill(inventoryStatus)}
              </div>
              <div class="info-grid">
                ${infoBox("当前库存", product.stock)}
                ${infoBox("可售库存", Math.max(product.stock - 6, 0))}
                ${infoBox("联动规则", product.stock === 0 ? "暂停待发布任务" : "发布前校验")}
                ${infoBox("最近更新", product.updatedAt)}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderData() {
  root.innerHTML = `
    ${renderKpis()}
    <section class="grid two-col">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>商品表现</h2>
            <p>MVP 先展示结构，后续接平台数据回流。</p>
          </div>
        </div>
        <div class="bar-chart">
          ${bar("智能恒温杯", 82, "#2563eb")}
          ${bar("折叠补光灯", 48, "#0f9f8f")}
          ${bar("收纳包", 65, "#6d5bd0")}
          ${bar("燕麦能量棒", 54, "#b7791f")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>自动化数据</h2>
            <p>用来反向优化模板、账号和商品运营策略。</p>
          </div>
        </div>
        <div class="bar-chart">
          ${bar("图片生成成功率", 92, "#138a54")}
          ${bar("视频生成成功率", 76, "#2563eb")}
          ${bar("审核通过率", 68, "#6d5bd0")}
          ${bar("发布成功率", 81, "#0f9f8f")}
        </div>
      </div>
    </section>
  `;
}

function bar(label, value, color) {
  return `
    <div class="bar-row">
      <span>${label}</span>
      <div class="bar"><span style="--value:${value}%;--color:${color}"></span></div>
      <strong>${value}%</strong>
    </div>
  `;
}

function render() {
  if (state.view === "dashboard") renderDashboard();
  if (state.view === "products") renderProducts();
  if (state.view === "generator") renderGenerator();
  if (state.view === "review") renderReview();
  if (state.view === "publish") renderPublish();
  if (state.view === "assets") renderAssets();
  if (state.view === "accounts") renderAccounts();
  if (state.view === "inventory") renderInventory();
  if (state.view === "data") renderData();
}

function createGeneratedAsset(productId, kind) {
  const product = productById(productId);
  const typeMap = {
    image: ["主图", "AI 图片"],
    copy: ["发布文案", "AI 文案"],
    video: ["短视频", "AI 视频"],
  };
  const [type, label] = typeMap[kind];
  const asset = {
    id: `A${String(assets.length + 1).padStart(3, "0")}`,
    productId,
    name: `${product.name}${label} ${assets.length + 1}`,
    type,
    status: "待审核",
    usage: "素材库",
    version: "v1",
    kind: kind === "copy" ? "copy" : kind,
  };
  assets.unshift(asset);
  reviews.unshift({
    id: `R${String(reviews.length + 1).padStart(3, "0")}`,
    productId,
    target: asset.name,
    type: kind === "image" ? "图片" : kind === "copy" ? "文案" : "视频",
    status: "待审核",
    reviewer: kind === "video" ? "内容审核" : "运营审核",
    reason: "新生成结果等待确认",
  });
  product.status = "待审核";
  product[`${kind}Status`] = "待审核";
  logs.unshift({ productId, text: `${label}生成完成，已加入审核队列`, time: "刚刚" });
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  if (action === "go") {
    setView(target.dataset.view);
    return;
  }
  if (action === "select-product") {
    state.selectedProductId = target.dataset.id;
    setView("products");
    return;
  }
  if (action === "filter-product") {
    state.productFilter = target.dataset.status;
    renderProducts();
    return;
  }
  if (action === "generator-tab") {
    state.activeGenerator = target.dataset.tab;
    renderGenerator();
    return;
  }
  if (action === "run-generator") {
    createGeneratedAsset(state.selectedProductId, state.activeGenerator);
    showToast("生成任务已完成模拟执行，结果已进入素材库和审核队列。");
    renderGenerator();
    return;
  }
  if (action === "open-review") {
    state.selectedReviewId = target.dataset.id;
    setView("review");
    return;
  }
  if (action === "choose-review") {
    state.selectedReviewId = target.dataset.id;
    renderReview();
    return;
  }
  if (["approve-review", "change-approve", "reject-review", "regen-review"].includes(action)) {
    const review = reviews.find((item) => item.id === target.dataset.id);
    if (review) {
      if (action === "approve-review") review.status = "审核通过";
      if (action === "change-approve") review.status = "修改后通过";
      if (action === "reject-review") review.status = "审核驳回";
      if (action === "regen-review") review.status = "要求重新生成";
      const product = productById(review.productId);
      const relatedAsset = assets.find((asset) => asset.name === review.target);
      if (relatedAsset) relatedAsset.status = review.status;
      if (["审核通过", "修改后通过"].includes(review.status)) {
        product.status = "审核通过";
        product.imageStatus = product.imageStatus === "待审核" ? "审核通过" : product.imageStatus;
        product.copyStatus = product.copyStatus === "待审核" ? "审核通过" : product.copyStatus;
        product.videoStatus = product.videoStatus === "待审核" ? "审核通过" : product.videoStatus;
      }
      if (review.status === "审核驳回") product.status = "异常";
      logs.unshift({ productId: review.productId, text: `${review.target}：${review.status}`, time: "刚刚" });
      showToast(`审核结果已更新：${review.status}`);
    }
    renderReview();
    return;
  }
  if (action === "create-publish") {
    const productId = target.dataset.product || state.selectedProductId;
    publishTasks.unshift({
      id: `PUB${String(publishTasks.length + 1).padStart(3, "0")}`,
      productId,
      platform: "抖音",
      account: "抖音内容号 A",
      status: productById(productId).stock === 0 ? "已暂停" : "待发布",
      time: "今天 20:00",
      attachProduct: true,
    });
    showToast("发布任务已创建，并完成库存校验。");
    setView("publish");
    return;
  }
  if (action === "create-review" || action === "asset-review") {
    const productId = target.dataset.product || state.selectedProductId;
    reviews.unshift({
      id: `R${String(reviews.length + 1).padStart(3, "0")}`,
      productId,
      target: `${productById(productId).name} 手动提交项`,
      type: "素材",
      status: "待审核",
      reviewer: "运营审核",
      reason: "手动提交审核",
    });
    showToast("已加入审核队列。");
    setView("review");
    return;
  }
  if (action === "mock-create") {
    const id = `P${1000 + products.length + 1}`;
    products.unshift({
      id,
      name: "弱信息新商品",
      code: `SKU-DRAFT-${products.length + 1}`,
      category: "待识别",
      price: 0,
      stock: 0,
      warningStock: 20,
      platforms: ["待选择"],
      accounts: ["未绑定"],
      status: "待完善",
      imageStatus: "未生成",
      copyStatus: "未生成",
      videoStatus: "未生成",
      listingStatus: "未上架",
      publishStatus: "未发布",
      progress: 12,
      updatedAt: "刚刚",
      colors: ["#e2e8f0", "#93c5fd"],
      sellingPoints: "只上传了基础素材，等待 AI 识别和补全。",
      specs: "待补充",
    });
    state.selectedProductId = id;
    showToast("已按弱信息创建商品档案，可继续生成素材。");
    renderProducts();
    return;
  }
  if (action === "create-listing") {
    const product = productById(state.selectedProductId);
    listingTasks.unshift({
      id: `L${String(listingTasks.length + 1).padStart(3, "0")}`,
      productId: product.id,
      platform: product.platforms[0] || "待选择",
      account: product.accounts[0] || "未绑定",
      status: product.stock === 0 ? "库存拦截" : "草稿中",
      completeness: product.stock === 0 ? 52 : 72,
    });
    product.listingStatus = product.stock === 0 ? "库存拦截" : "草稿中";
    logs.unshift({ productId: product.id, text: "已创建上架草稿并完成库存校验", time: "刚刚" });
    showToast("上架草稿已创建。");
    renderPublish();
    return;
  }
  if (action === "sync-stock") {
    const paused = productById("P1003");
    paused.stock = 45;
    paused.status = "待发布";
    paused.publishStatus = "待发布";
    publishTasks
      .filter((task) => task.productId === "P1003")
      .forEach((task) => {
        task.status = "待发布";
        task.time = "库存恢复后待排期";
      });
    logs.unshift({ productId: "P1003", text: "库存同步恢复，待发布任务已恢复", time: "刚刚" });
    showToast("库存已同步，售罄商品恢复为待发布。");
    renderInventory();
    return;
  }
  if (["save-template", "export-task", "mock-account"].includes(action)) {
    showToast("MVP 已记录该操作入口，后续接入真实服务。");
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-action='choose-product']")) {
    state.selectedProductId = event.target.value;
    renderGenerator();
  }
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

render();
