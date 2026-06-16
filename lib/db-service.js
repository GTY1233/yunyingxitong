const fs = require("fs");
const path = require("path");

const DATA_KEYS = [
  "products", "workflows", "workflowInstances", "customWorkflowTemplates",
  "platformWorkflows", "assets", "generationTasks", "listingTasks",
  "publishTasks", "accounts", "platformFailures", "logs",
  "productImages", "modelImages", "generatedModelImages", "templateVideos",
  "strategies", "templatePresets",
];

function emptyDb() {
  return Object.fromEntries(DATA_KEYS.map((k) => [k, []]));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function createDbService(dbPath) {
  let writeQ = Promise.resolve();

  function ensureDir() {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  function read() {
    ensureDir();
    if (!fs.existsSync(dbPath)) return emptyDb();
    try {
      const raw = fs.readFileSync(dbPath, "utf8");
      return normalizeDb(JSON.parse(raw));
    } catch { return emptyDb(); }
  }

  function writeAtomic(input) {
    ensureDir();
    const db = normalizeDb(input);
    const json = JSON.stringify(db, null, 2) + "\n";
    const tmp = dbPath + ".tmp." + process.pid;
    fs.writeFileSync(tmp, json, "utf8");
    fs.renameSync(tmp, dbPath);
    return db;
  }

  function mutexWrite(updater) {
    writeQ = writeQ.then(() => {
      const current = read();
      const next = updater(current);
      if (next) writeAtomic(next);
    }).catch(() => {});
    return writeQ;
  }

  function readAndWrite(updater) {
    const current = read();
    const next = updater(current);
    return writeAtomic(next);
  }

  return { read, readAndWrite, mutexWrite };
}

const LEGACY_MAP = {
  待审核: "已生成", 审核通过: "已生成", 审核驳回: "生成失败", 生成成功: "已生成",
};

function normalizeDb(input) {
  const db = emptyDb();
  DATA_KEYS.forEach((k) => { db[k] = Array.isArray(input?.[k]) ? deepClone(input[k]) : []; });
  migrateAll(db);
  return db;
}

function migrateAll(db) {
  let changed = false;
  (db.assets || []).forEach((a) => {
    if (LEGACY_MAP[a.status]) { a.status = LEGACY_MAP[a.status]; changed = true; }
    if (a.usage === "素材库") { a.usage = "成品库"; changed = true; }
  });
  (db.products || []).forEach((p) => {
    if (p.status === "待审核") { p.status = "待发布"; changed = true; }
    ["imageStatus", "copyStatus", "videoStatus"].forEach((f) => {
      if (LEGACY_MAP[p[f]]) { p[f] = LEGACY_MAP[p[f]]; changed = true; }
    });
  });
  (db.publishTasks || []).forEach((t) => {
    if (!t.assetId && t.asset?.id) { t.assetId = t.asset.id; changed = true; }
  });
  (db.listingTasks || []).forEach((t) => {
    if (!t.mode && t.status === "草稿中") { t.mode = "半自动"; changed = true; }
  });
  (db.platformWorkflows || []).forEach((w) => {
    (w.nodes || []).forEach((n) => {
      if (n.status === "已跳过" && n.error) { n.error = ""; changed = true; }
    });
  });
  return changed;
}

module.exports = { createDbService, emptyDb, normalizeDb, DATA_KEYS };
