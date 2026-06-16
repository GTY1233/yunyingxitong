const { findAccount } = require("./account-utils");
const { checkInventory } = require("./inventory-service");
const { getPlatformAdapter, listPlatformCapabilities } = require("./platform/registry");
const { highestCapability } = require("./platform/capabilities");

function recordPlatformFailure(db, payload, helpers) {
  db.platformFailures = db.platformFailures || [];
  const record = {
    id: helpers.nextId(db.platformFailures, "PF"),
    taskType: payload.taskType,
    taskId: payload.taskId,
    productId: payload.productId,
    platform: payload.platform,
    reason: payload.reason,
    capability: payload.capability || "unknown",
    createdAt: helpers.formatNow(),
    status: "待处理",
  };
  db.platformFailures.unshift(record);
  return record;
}

function buildPublishContext(db, task) {
  const product = (db.products || []).find((item) => item.id === task.productId);
  const account = findAccount(db, { id: task.accountId, name: task.account });
  const asset = task.assetId ? (db.assets || []).find((item) => item.id === task.assetId) : null;
  return { db, product, task, account, asset };
}

function buildListingContext(db, task) {
  const product = (db.products || []).find((item) => item.id === task.productId);
  const account = findAccount(db, { name: task.account });
  return { db, product, task, account };
}

function dispatchPublish(db, task, helpers) {
  const inventory = checkInventory(buildPublishContext(db, task).product, "publish", {
    blockOnLowStock: task.forceLowStock !== true,
    allowLowStock: task.forceLowStock === true,
  });
  if (inventory.blocked) {
    return { ok: false, error: inventory.reason, inventory };
  }

  const ctx = buildPublishContext(db, task);
  const adapter = getPlatformAdapter(task.platform);
  const result = adapter.publish(ctx);

  task.platformCapability = result.capability || highestCapability(adapter.capabilities);
  task.platformMode = result.capability || adapter.resolveMode(task.mode);
  if (result.externalId) task.externalId = result.externalId;

  if (!result.ok) {
    recordPlatformFailure(
      db,
      {
        taskType: "publish",
        taskId: task.id,
        productId: task.productId,
        platform: task.platform,
        reason: result.error,
        capability: result.capability,
      },
      helpers
    );
  }

  return { ...result, warn: inventory.warn ? inventory.reason : "", adapter: adapter.platform };
}

function dispatchListing(db, task, helpers) {
  const inventory = checkInventory(buildListingContext(db, task).product, "listing", {
    blockOnLowStock: task.forceLowStock !== true,
  });
  if (inventory.blocked) {
    return { ok: false, error: inventory.reason, inventory };
  }

  const ctx = buildListingContext(db, task);
  const adapter = getPlatformAdapter(task.platform);
  const result = adapter.listing(ctx);

  task.platformCapability = result.capability || highestCapability(adapter.capabilities);
  task.platformMode = result.capability || "semiAuto";
  if (result.externalId) task.externalId = result.externalId;
  if (result.ok && ctx.product) {
    ctx.product.platformProductIds = ctx.product.platformProductIds || {};
    ctx.product.platformProductIds[task.platform] = result.externalId;
    if (result.response) task.platformResponse = result.response;
  }

  if (!result.ok) {
    recordPlatformFailure(
      db,
      {
        taskType: "listing",
        taskId: task.id,
        productId: task.productId,
        platform: task.platform,
        reason: result.error,
        capability: result.capability,
      },
      helpers
    );
  }

  return { ...result, warn: inventory.warn ? inventory.reason : "", adapter: adapter.platform };
}

function buildPlatformExport(db, task, type, helpers) {
  const adapter = getPlatformAdapter(task.platform);
  const ctx = type === "listing" ? buildListingContext(db, task) : buildPublishContext(db, task);
  const pack = adapter.buildExport(ctx);
  pack.platformFailures = (db.platformFailures || []).filter((item) => item.taskId === task.id).slice(0, 3);
  pack.inventory = checkInventory(ctx.product, type === "listing" ? "listing" : "publish");
  return pack;
}

function migratePlatformFailures(db) {
  if (!Array.isArray(db.platformFailures)) db.platformFailures = [];
}

module.exports = {
  listPlatformCapabilities,
  dispatchPublish,
  dispatchListing,
  buildPlatformExport,
  recordPlatformFailure,
  migratePlatformFailures,
};
