// 平台凭证仓储。secret/token 字段加密存储;getDecrypted 只在调平台 API 前内存解密,绝不返前端。
const { open, seal } = require("../security/secret-box");
const { getPrisma } = require("./client");

function list() {
  return getPrisma().platformCredential.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

function getById(id) {
  return getPrisma().platformCredential.findUnique({ where: { id } });
}

function getByApi(platform, api) {
  return getPrisma().platformCredential.findFirst({ where: { platform, api, deletedAt: null } });
}

// 创建/更新某 (platform,api) 的凭证配置;appSecret 仅在提供时加密更新。
async function upsertConfig({ platform, api, label, role, appKey, appSecret }) {
  const existing = await getByApi(platform, api);
  const data = { platform, api };
  if (label !== undefined) data.label = label;
  if (role !== undefined) data.role = role;
  if (appKey !== undefined) data.appKey = appKey;
  if (appSecret) data.appSecretEnc = seal(appSecret); // 加密
  if (existing) return getPrisma().platformCredential.update({ where: { id: existing.id }, data });
  return getPrisma().platformCredential.create({ data });
}

async function saveTokens(
  id,
  { accessToken, refreshToken, shopId, expiresInSec, refreshExpiresInSec }
) {
  const now = Date.now();
  const data = { status: "已授权", lastError: null };
  if (accessToken) data.accessTokenEnc = seal(accessToken);
  if (refreshToken) data.refreshTokenEnc = seal(refreshToken);
  if (shopId) data.shopId = String(shopId);
  if (expiresInSec) data.tokenExpiresAt = new Date(now + Number(expiresInSec) * 1000);
  if (refreshExpiresInSec)
    data.refreshExpiresAt = new Date(now + Number(refreshExpiresInSec) * 1000);
  return getPrisma().platformCredential.update({ where: { id }, data });
}

// 解密敏感字段(仅内存,调平台 API 前用;不得返前端)。
async function getDecrypted(id) {
  const c = await getById(id);
  if (!c) return null;
  return {
    id: c.id,
    platform: c.platform,
    api: c.api,
    role: c.role,
    shopId: c.shopId || "",
    runMode: c.runMode,
    status: c.status,
    appKey: c.appKey || "",
    appSecret: c.appSecretEnc ? open(c.appSecretEnc) : "",
    accessToken: c.accessTokenEnc ? open(c.accessTokenEnc) : "",
    refreshToken: c.refreshTokenEnc ? open(c.refreshTokenEnc) : "",
    tokenExpiresAt: c.tokenExpiresAt,
    refreshExpiresAt: c.refreshExpiresAt,
  };
}

function setRunMode(id, runMode) {
  return getPrisma().platformCredential.update({ where: { id }, data: { runMode } });
}

function softDelete(id) {
  return getPrisma().platformCredential.update({ where: { id }, data: { deletedAt: new Date() } });
}

function setStatus(id, status, lastError) {
  return getPrisma().platformCredential.update({
    where: { id },
    data: { status, lastError: lastError || null },
  });
}

// 脱敏视图(给前端):不含任何 secret/token 明文或密文。
function maskView(c) {
  return {
    id: c.id,
    platform: c.platform,
    api: c.api,
    label: c.label || "",
    role: c.role || "",
    appKey: c.appKey || "",
    appSecretSet: !!c.appSecretEnc,
    shopId: c.shopId || "",
    runMode: c.runMode,
    status: c.status,
    lastError: c.lastError || "",
    tokenSet: !!c.accessTokenEnc,
    tokenExpiresAt: c.tokenExpiresAt,
  };
}

module.exports = {
  list,
  getById,
  getByApi,
  upsertConfig,
  saveTokens,
  getDecrypted,
  setRunMode,
  setStatus,
  softDelete,
  maskView,
};
