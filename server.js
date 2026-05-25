const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
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
};

const DATA_KEYS = [
  "products",
  "workflows",
  "assets",
  "reviews",
  "listingTasks",
  "publishTasks",
  "accounts",
  "logs",
];

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

function readDb() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) return emptyDb();

  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeDb(parsed);
  } catch (error) {
    return emptyDb();
  }
}

function normalizeDb(input) {
  const db = emptyDb();
  DATA_KEYS.forEach((key) => {
    db[key] = Array.isArray(input && input[key]) ? input[key] : [];
  });
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

function addLog(db, productId, text) {
  db.logs.unshift({
    productId,
    text,
    time: "刚刚",
  });
}

function inferResourcePrefix(resource) {
  const prefixes = {
    products: "P",
    workflows: "W",
    assets: "A",
    reviews: "R",
    listingTasks: "L",
    publishTasks: "PUB",
    accounts: "AC",
    logs: "LOG",
  };
  return prefixes[resource] || "ID";
}

function sendSavedState(res, db, message) {
  const saved = writeDb(db);
  sendJson(res, 200, { ok: true, message, data: saved });
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
    sendJson(res, 200, { ok: true, service: "yunyingxitong-mvp" });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/state") {
    sendJson(res, 200, readDb());
    return true;
  }

  if (req.method === "POST" && req.url === "/api/state") {
    try {
      const body = await readBody(req);
      const saved = writeDb(JSON.parse(body || "{}"));
      sendJson(res, 200, { ok: true, data: saved });
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
        const item = {
          ...body,
          id: body.id || nextId(db[resource], inferResourcePrefix(resource)),
        };
        db[resource].unshift(item);
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

      if (!product) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }

      const typeMap = {
        image: ["主图", "AI 图片", "图片"],
        copy: ["发布文案", "AI 文案", "文案"],
        video: ["短视频", "AI 视频", "视频"],
      };
      const [type, label, reviewType] = typeMap[kind];
      const asset = {
        id: nextId(db.assets, "A"),
        productId: product.id,
        name: `${product.name}${label} ${db.assets.length + 1}`,
        type,
        status: "待审核",
        usage: "素材库",
        version: "v1",
        kind: kind === "copy" ? "copy" : kind,
      };
      const review = {
        id: nextId(db.reviews, "R"),
        productId: product.id,
        target: asset.name,
        type: reviewType,
        status: "待审核",
        reviewer: kind === "video" ? "内容审核" : "运营审核",
        reason: "新生成结果等待确认",
      };

      db.assets.unshift(asset);
      db.reviews.unshift(review);
      product.status = "待审核";
      product[`${kind}Status`] = "待审核";
      addLog(db, product.id, `${label}生成完成，已加入审核队列`);
      sendSavedState(res, db, "Generation completed");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/reviews") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const product = getProduct(db, body.productId);

      if (!product) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }

      db.reviews.unshift({
        id: nextId(db.reviews, "R"),
        productId: product.id,
        target: body.target || `${product.name} 手动提交项`,
        type: body.type || "素材",
        status: "待审核",
        reviewer: body.reviewer || "运营审核",
        reason: body.reason || "手动提交审核",
      });
      addLog(db, product.id, "已手动提交审核任务");
      sendSavedState(res, db, "Review task created");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const reviewDecisionMatch = url.pathname.match(/^\/api\/actions\/reviews\/([^/]+)\/decision$/);
  if (req.method === "POST" && reviewDecisionMatch) {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const review = db.reviews.find((item) => item.id === reviewDecisionMatch[1]);

      if (!review) {
        sendJson(res, 404, { ok: false, error: "Review not found" });
        return true;
      }

      const allowed = ["审核通过", "修改后通过", "审核驳回", "要求重新生成"];
      review.status = allowed.includes(body.decision) ? body.decision : "审核通过";

      const product = getProduct(db, review.productId);
      const relatedAsset = db.assets.find((asset) => asset.name === review.target);
      if (relatedAsset) relatedAsset.status = review.status;

      if (product && ["审核通过", "修改后通过"].includes(review.status)) {
        product.status = "审核通过";
        product.imageStatus = product.imageStatus === "待审核" ? "审核通过" : product.imageStatus;
        product.copyStatus = product.copyStatus === "待审核" ? "审核通过" : product.copyStatus;
        product.videoStatus = product.videoStatus === "待审核" ? "审核通过" : product.videoStatus;
      }
      if (product && review.status === "审核驳回") product.status = "异常";

      addLog(db, review.productId, `${review.target}：${review.status}`);
      sendSavedState(res, db, "Review decision saved");
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

      db.publishTasks.unshift({
        id: nextId(db.publishTasks, "PUB"),
        productId: product.id,
        platform: body.platform || "抖音",
        account: body.account || "抖音内容号 A",
        status: product.stock === 0 ? "已暂停" : "待发布",
        time: body.time || "今天 20:00",
        attachProduct: body.attachProduct !== false,
      });
      product.publishStatus = product.stock === 0 ? "已暂停" : "待发布";
      addLog(db, product.id, "发布任务已创建，并完成库存校验");
      sendSavedState(res, db, "Publish task created");
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

      const blocked = product.stock === 0;
      db.listingTasks.unshift({
        id: nextId(db.listingTasks, "L"),
        productId: product.id,
        platform: body.platform || product.platforms[0] || "待选择",
        account: body.account || product.accounts[0] || "未绑定",
        status: blocked ? "库存拦截" : "草稿中",
        completeness: blocked ? 52 : 72,
      });
      product.listingStatus = blocked ? "库存拦截" : "草稿中";
      addLog(db, product.id, "已创建上架草稿并完成库存校验");
      sendSavedState(res, db, "Listing draft created");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/actions/inventory/sync") {
    try {
      const db = readDb();
      const body = parseJsonBody(await readBody(req));
      const product = getProduct(db, body.productId || "P1003");

      if (!product) {
        sendJson(res, 404, { ok: false, error: "Product not found" });
        return true;
      }

      product.stock = Number.isFinite(Number(body.stock)) ? Number(body.stock) : 45;
      product.status = product.stock === 0 ? "已暂停" : "待发布";
      product.publishStatus = product.stock === 0 ? "已暂停" : "待发布";
      db.publishTasks
        .filter((task) => task.productId === product.id)
        .forEach((task) => {
          task.status = product.stock === 0 ? "已暂停" : "待发布";
          task.time = product.stock === 0 ? "库存恢复后" : "库存恢复后待排期";
        });
      addLog(db, product.id, "库存同步恢复，待发布任务已恢复");
      sendSavedState(res, db, "Inventory synced");
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  return false;
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

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`AI ecommerce ops MVP is running at http://localhost:${PORT}`);
});
