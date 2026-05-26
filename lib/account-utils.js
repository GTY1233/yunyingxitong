function findAccount(db, { id, name } = {}) {
  if (id) return (db.accounts || []).find((item) => item.id === id) || null;
  if (name) return (db.accounts || []).find((item) => item.name === name) || null;
  return null;
}

function resolvePublishAccount(db, product, body = {}) {
  return (
    findAccount(db, { id: body.accountId }) ||
    findAccount(db, { name: body.account || body.accountName }) ||
    findAccount(db, { name: product.accounts?.[0] }) ||
    null
  );
}

function accountCanPublish(account) {
  if (!account) return { ok: false, reason: "未绑定发布账号" };
  if (account.auth === "授权已失效") return { ok: false, reason: "账号授权已失效，请重新授权" };
  if (account.auth === "未授权") return { ok: false, reason: "账号尚未授权" };
  if (account.auth === "授权即将过期") return { ok: true, warn: "授权即将过期，建议尽快续期" };
  if (account.auth !== "已授权") return { ok: false, reason: `账号状态异常：${account.auth}` };
  return { ok: true };
}

function accountPersonaForCopy(account) {
  if (!account) return "";
  return `发布账号「${account.name}」，人设：${account.persona}，发布规则：${account.rule}`;
}

function contentAccountsForProduct(db, product) {
  const names = new Set(product.accounts || []);
  return (db.accounts || []).filter((item) => names.has(item.name) && item.type === "内容账号");
}

function shopAccountsForProduct(db, product) {
  const names = new Set(product.accounts || []);
  return (db.accounts || []).filter((item) => names.has(item.name) && item.type === "店铺账号");
}

function parseDailyLimit(rule) {
  const match = String(rule || "").match(/(\d+)\s*条/);
  return match ? Number(match[1]) : 0;
}

function dailyPublishCount(db, accountId, scheduleSlot = "今天") {
  return (db.publishTasks || []).filter(
    (item) =>
      item.accountId === accountId &&
      item.scheduleSlot === scheduleSlot &&
      ["待发布", "发布中", "已成功"].includes(item.status)
  ).length;
}

function enrichCopyParams(db, product, params = {}) {
  const next = { ...params };
  let account =
    findAccount(db, { id: next.accountId }) ||
    findAccount(db, { name: next.accountName || next.account }) ||
    contentAccountsForProduct(db, product)[0] ||
    findAccount(db, { name: product.accounts?.[0] });

  if (account) {
    next.accountId = account.id;
    next.accountName = account.name;
    next.accountPersona = accountPersonaForCopy(account);
    if (!next.platform) next.platform = account.platform;
  }
  return next;
}

module.exports = {
  findAccount,
  resolvePublishAccount,
  accountCanPublish,
  accountPersonaForCopy,
  contentAccountsForProduct,
  shopAccountsForProduct,
  parseDailyLimit,
  dailyPublishCount,
  enrichCopyParams,
};
