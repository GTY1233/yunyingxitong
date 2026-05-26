const {
  findAccount,
  resolvePublishAccount,
  accountCanPublish,
  parseDailyLimit,
  dailyPublishCount,
} = require("./account-utils");
const { checkInventory } = require("./inventory-service");
const { dispatchPublish } = require("./platform-service");

function inferScheduleSlot(time) {
  const text = String(time || "");
  if (text.includes("明天")) return "明天";
  if (text.includes("本周") || text.includes("恢复")) return "本周";
  return "今天";
}

function buildScheduleTime(body = {}) {
  const slot = body.scheduleSlot || inferScheduleSlot(body.time);
  const clock =
    body.scheduleTime ||
    String(body.time || "").match(/\d{1,2}:\d{2}/)?.[0] ||
    "18:00";
  if (slot === "明天") return `明天 ${clock}`;
  if (slot === "本周") return `本周 ${clock}`;
  return `今天 ${clock}`;
}

function normalizePublishTask(task, account, body = {}) {
  task.accountId = account?.id || task.accountId || "";
  task.account = account?.name || task.account || "未绑定";
  task.platform = body.platform || account?.platform || task.platform || "抖音";
  task.scheduleSlot = body.scheduleSlot || task.scheduleSlot || inferScheduleSlot(task.time);
  task.time = buildScheduleTime({ ...body, scheduleSlot: task.scheduleSlot, time: task.time || body.time });
  task.failureReason = task.failureReason || "";
  task.attempts = Number.isFinite(Number(task.attempts)) ? Number(task.attempts) : 0;
  task.maxAttempts = Number.isFinite(Number(task.maxAttempts)) ? Number(task.maxAttempts) : 2;
  task.mode = task.mode || "半自动";
  task.createdAt = task.createdAt || "";
  task.updatedAt = task.updatedAt || task.createdAt || "";
  task.publishedAt = task.publishedAt || "";
  return task;
}

function validatePublishPreconditions(db, product, account, options = {}) {
  if (!product) return { error: "商品不存在" };
  const inventory = checkInventory(product, "publish", {
    blockOnLowStock: options.blockOnLowStock === true,
    allowLowStock: options.allowLowStock === true,
  });
  if (inventory.blocked) return { error: inventory.reason };
  if (!account) return { error: "未绑定发布账号" };
  if (account.type === "店铺账号" && !options.allowShopAccount) {
    return { error: "店铺账号用于上架，请选择内容账号发布" };
  }

  const auth = accountCanPublish(account);
  if (!auth.ok) return { error: auth.reason };

  const limit = parseDailyLimit(account.rule);
  if (limit > 0 && account.id) {
    const slot = options.scheduleSlot || "今天";
    if (dailyPublishCount(db, account.id, slot) >= limit) {
      return { error: `已超过账号「${account.name}」${slot}发布上限（${limit} 条）` };
    }
  }

  return { ok: true, warn: auth.warn || (inventory.warn ? inventory.reason : "") };
}

function createPublishTask(db, product, body, asset, helpers) {
  const account = resolvePublishAccount(db, product, body);
  const scheduleSlot = body.scheduleSlot || inferScheduleSlot(body.time);
  const check = validatePublishPreconditions(db, product, account, {
    scheduleSlot,
    allowLowStock: body.forceLowStock === true,
  });

  if (check.error && body.force !== true) {
    throw new Error(check.error);
  }

  const task = normalizePublishTask(
    {
      id: helpers.nextId(db.publishTasks, "PUB"),
      productId: product.id,
      assetId: asset?.id || body.assetId || "",
      assetName: asset?.name || body.assetName || "",
      status: check.error || product.stock === 0 ? "已暂停" : "待发布",
      time: buildScheduleTime(body),
      scheduleSlot,
      attachProduct: body.attachProduct !== false,
      failureReason: check.error || check.warn || "",
      attempts: 0,
      maxAttempts: 2,
      mode: body.mode || "半自动",
      forceLowStock: body.forceLowStock === true,
      createdAt: helpers.formatNow(),
      updatedAt: helpers.formatNow(),
    },
    account,
    body
  );

  db.publishTasks.unshift(task);

  if (!check.error && product.stock > 0) {
    product.publishStatus = "待发布";
    if (asset) {
      asset.status = "已发布";
      asset.usage = "发布任务";
      const kindField =
        asset.kind === "copy" ? "copyStatus" : asset.kind === "video" ? "videoStatus" : "imageStatus";
      if (product[kindField] === "已生成") product[kindField] = "已发布";
    }
  } else if (product.stock === 0) {
    product.publishStatus = "已暂停";
    task.status = "已暂停";
    task.time = "库存恢复后";
    task.scheduleSlot = "本周";
  }

  return task;
}

function executePublishTask(db, taskId, helpers) {
  const task = (db.publishTasks || []).find((item) => item.id === taskId);
  if (!task) return { error: "Publish task not found" };
  if (!["待发布", "失败"].includes(task.status)) {
    return { error: "当前状态不可执行半自动发布" };
  }

  const product = (db.products || []).find((item) => item.id === task.productId);
  const account = findAccount(db, { id: task.accountId, name: task.account });
  const asset = task.assetId ? (db.assets || []).find((item) => item.id === task.assetId) : null;
  const check = validatePublishPreconditions(db, product, account, { scheduleSlot: task.scheduleSlot });

  task.attempts = (task.attempts || 0) + 1;
  task.status = "发布中";
  task.updatedAt = helpers.formatNow();

  if (check.error) {
    task.status = "失败";
    task.failureReason = check.error;
  } else {
    const platformResult = dispatchPublish(db, task, helpers);
    if (platformResult.ok) {
      task.status = "已成功";
      task.failureReason = platformResult.warn || "";
      task.publishedAt = helpers.formatNow();
      if (product) product.publishStatus = "已发布";
      if (asset) {
        asset.status = "已发布";
        asset.usage = "已发布";
        asset.publishCount = (asset.publishCount || 0) + 1;
        asset.lastUsedAt = helpers.formatNow();
      }
      helpers.addLog(
        db,
        task.productId,
        `[发布] ${platformResult.message || "平台发布成功"}（${task.account} / ${task.platform} / ${task.platformMode || "semiAuto"}）`,
        "publish"
      );
    } else {
      task.status = "失败";
      task.failureReason = platformResult.error;
      if (platformResult.fallback === "export") {
        task.failureReason = `${platformResult.error}（可改用导出发布）`;
      }
    }
  }

  if (task.status === "失败") {
    helpers.addLog(db, task.productId, `[发布] 发布失败：${task.failureReason}（${task.id}）`, "publish");
  }

  task.updatedAt = helpers.formatNow();
  return { task };
}

function retryPublishTask(db, taskId, helpers) {
  const task = (db.publishTasks || []).find((item) => item.id === taskId);
  if (!task) return { error: "Publish task not found" };
  if (task.status !== "失败") return { error: "只有失败任务可以重试" };
  if ((task.attempts || 0) >= (task.maxAttempts || 2)) {
    return { error: "已达到最大重试次数" };
  }
  task.status = "待发布";
  task.failureReason = "";
  task.updatedAt = helpers.formatNow();
  return executePublishTask(db, taskId, helpers);
}

function reschedulePublishTask(db, taskId, body, helpers) {
  const task = (db.publishTasks || []).find((item) => item.id === taskId);
  if (!task) return { error: "Publish task not found" };
  if (["已成功", "发布中"].includes(task.status)) {
    return { error: "已完成或执行中的任务不能改期" };
  }

  const account = findAccount(db, { id: task.accountId, name: task.account });
  task.scheduleSlot = body.scheduleSlot || task.scheduleSlot;
  task.time = buildScheduleTime({ ...body, scheduleSlot: task.scheduleSlot });
  if (task.status === "已暂停" && body.resume === true) {
    const product = (db.products || []).find((item) => item.id === task.productId);
    const check = validatePublishPreconditions(db, product, account, { scheduleSlot: task.scheduleSlot });
    if (check.error) return { error: check.error };
    task.status = "待发布";
    task.failureReason = check.warn || "";
  }
  task.updatedAt = helpers.formatNow();
  helpers.addLog(db, task.productId, `[发布] 已改期至 ${task.time}（${task.id}）`, "publish");
  return { task };
}

function buildPublishExportPack(db, taskId, getProduct, getAsset) {
  const task = (db.publishTasks || []).find((item) => item.id === taskId);
  if (!task) return null;
  const product = getProduct(db, task.productId);
  if (!product) return null;
  const asset = task.assetId ? getAsset(db, task.assetId) : null;
  const account = findAccount(db, { id: task.accountId, name: task.account });
  const productAssets = (db.assets || []).filter((item) => item.productId === product.id && item.status === "已生成");

  return {
    exportedAt: new Date().toISOString(),
    mode: "半自动导出",
    task,
    product: {
      id: product.id,
      name: product.name,
      code: product.code,
      sellingPoints: product.sellingPoints,
      specs: product.specs,
      price: product.price,
    },
    account: account
      ? { id: account.id, name: account.name, platform: account.platform, persona: account.persona, rule: account.rule }
      : { name: task.account, platform: task.platform },
    primaryAsset: asset,
    materials: productAssets,
    publishHint: "将本包内容按目标平台要求手动或半自动上传发布。",
  };
}

function migratePublishTasks(db) {
  let changed = false;
  (db.publishTasks || []).forEach((task) => {
    const before = JSON.stringify(task);
    const account = findAccount(db, { id: task.accountId, name: task.account });
    normalizePublishTask(task, account, { time: task.time });
    if (JSON.stringify(task) !== before) changed = true;
  });
  return changed;
}

module.exports = {
  inferScheduleSlot,
  buildScheduleTime,
  normalizePublishTask,
  createPublishTask,
  executePublishTask,
  retryPublishTask,
  reschedulePublishTask,
  buildPublishExportPack,
  migratePublishTasks,
};
