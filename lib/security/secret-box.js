// 凭证密文封装:AES-256-GCM。密文格式 v1:iv:tag:cipher(各段 base64)。
// 主密钥来自 env PLATFORM_CRED_ENC_KEY(64 位 hex,= 32 字节;生成:openssl rand -hex 32)。
// 只在「存真实凭证」时用到;demo 模式不存 secret,故无 key 也能跑。
const crypto = require("node:crypto");

function getKey() {
  const hex = String(process.env.PLATFORM_CRED_ENC_KEY || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "缺少或非法 PLATFORM_CRED_ENC_KEY(需 64 位 hex;生成:openssl rand -hex 32),无法加密平台凭证"
    );
  }
  return Buffer.from(hex, "hex");
}

function seal(plaintext) {
  if (plaintext == null || plaintext === "") return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

function open(sealed) {
  if (!sealed) return "";
  const parts = String(sealed).split(":");
  if (parts[0] !== "v1" || parts.length !== 4) throw new Error("凭证密文格式错误");
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const enc = Buffer.from(parts[3], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function isSealed(v) {
  return typeof v === "string" && v.startsWith("v1:");
}

function hasKey() {
  return /^[0-9a-fA-F]{64}$/.test(String(process.env.PLATFORM_CRED_ENC_KEY || "").trim());
}

module.exports = { seal, open, isSealed, hasKey };
