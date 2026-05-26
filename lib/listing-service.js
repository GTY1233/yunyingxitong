const { computeListingCompleteness } = require("./listing-check");
const { checkInventory } = require("./inventory-service");
const { dispatchListing } = require("./platform-service");

function normalizeListingTask(task, body = {}) {
  task.failureReason = task.failureReason || "";
  task.attempts = Number.isFinite(Number(task.attempts)) ? Number(task.attempts) : 0;
  task.maxAttempts = Number.isFinite(Number(task.maxAttempts)) ? Number(task.maxAttempts) : 2;
  task.platformMode = task.platformMode || "";
  task.platformCapability = task.platformCapability || "";
  task.externalId = task.externalId || "";
  task.mode = task.mode || body.mode || "半自动";
  return task;
}

function createListingTask(db, product, body, helpers) {
  const inventory = checkInventory(product, "listing");
  if (inventory.blocked) throw new Error(inventory.reason);

  const check = computeListingCompleteness(db, product.id);
  const task = normalizeListingTask(
    {
      id: helpers.nextId(db.listingTasks, "L"),
      productId: product.id,
      platform: body.platform || product.platforms[0] || "待选择",
      account: body.account || product.accounts[0] || "未绑定",
      status: inventory.warn ? "库存预警" : check.completeness >= 80 ? "草稿中" : "待补充",
      completeness: check.completeness,
      missing: check.missing,
      createdAt: helpers.formatNow(),
      updatedAt: helpers.formatNow(),
    },
    body
  );

  if (inventory.warn) task.failureReason = inventory.reason;
  db.listingTasks.unshift(task);
  product.listingStatus = task.status;
  helpers.addLog(db, product.id, `[上架] 已创建草稿（${task.platform} / 完整度 ${task.completeness}%）`, "listing");
  return task;
}

function executeListingTask(db, taskId, helpers) {
  const task = (db.listingTasks || []).find((item) => item.id === taskId);
  if (!task) return { error: "Listing task not found" };
  if (!["草稿中", "待补充", "库存预警", "失败"].includes(task.status)) {
    return { error: "当前状态不可执行上架" };
  }

  const product = (db.products || []).find((item) => item.id === task.productId);
  const check = computeListingCompleteness(db, task.productId);
  if (check.completeness < 80) {
    task.status = "失败";
    task.failureReason = `字段完整度不足（${check.completeness}%），缺：${check.missing.slice(0, 3).join("、")}`;
    task.updatedAt = helpers.formatNow();
    return { task, error: task.failureReason };
  }

  task.attempts = (task.attempts || 0) + 1;
  task.status = "上架中";
  task.updatedAt = helpers.formatNow();

  const result = dispatchListing(db, task, helpers);
  if (result.ok) {
    task.status = "已上架";
    task.failureReason = result.warn || "";
    task.updatedAt = helpers.formatNow();
    if (product) {
      product.listingStatus = "已上架";
      product.status = product.stock <= product.warningStock ? "库存预警" : product.status;
    }
    helpers.addLog(db, task.productId, `[上架] 平台任务已提交（${task.platform}）`, "listing");
  } else {
    task.status = "失败";
    task.failureReason = result.error;
    task.updatedAt = helpers.formatNow();
    helpers.addLog(db, task.productId, `[上架] 失败：${result.error}（${task.id}）`, "listing");
  }

  return { task };
}

function retryListingTask(db, taskId, helpers) {
  const task = (db.listingTasks || []).find((item) => item.id === taskId);
  if (!task) return { error: "Listing task not found" };
  if (task.status !== "失败") return { error: "只有失败任务可以重试" };
  if ((task.attempts || 0) >= (task.maxAttempts || 2)) return { error: "已达到最大重试次数" };
  task.status = task.completeness >= 80 ? "草稿中" : "待补充";
  task.failureReason = "";
  return executeListingTask(db, taskId, helpers);
}

function migrateListingTasks(db) {
  let changed = false;
  (db.listingTasks || []).forEach((task) => {
    const before = JSON.stringify(task);
    normalizeListingTask(task);
    if (JSON.stringify(task) !== before) changed = true;
  });
  return changed;
}

module.exports = {
  createListingTask,
  executeListingTask,
  retryListingTask,
  migrateListingTasks,
  normalizeListingTask,
};
