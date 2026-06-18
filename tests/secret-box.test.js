import { beforeAll, describe, expect, it } from "vitest";

// 测试用固定密钥(64 hex)
const TEST_KEY = "0".repeat(64);
let box;

beforeAll(async () => {
  process.env.PLATFORM_CRED_ENC_KEY = TEST_KEY;
  box = await import("../lib/security/secret-box.js");
});

describe("secret-box(AES-256-GCM 凭证加密)", () => {
  it("seal→open 往返还原", () => {
    const plain = "app_secret_超级机密_123";
    const sealed = box.seal(plain);
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain(plain); // 密文里看不到明文
    expect(box.open(sealed)).toBe(plain);
  });

  it("空值处理", () => {
    expect(box.seal("")).toBe("");
    expect(box.seal(null)).toBe("");
    expect(box.open("")).toBe("");
  });

  it("isSealed 判定", () => {
    expect(box.isSealed(box.seal("x"))).toBe(true);
    expect(box.isSealed("明文")).toBe(false);
  });

  it("篡改密文 → 解密抛错(GCM 完整性)", () => {
    const sealed = box.seal("data");
    const parts = sealed.split(":");
    parts[3] = Buffer.from("篡改了").toString("base64");
    expect(() => box.open(parts.join(":"))).toThrow();
  });

  it("格式错误抛错", () => {
    expect(() => box.open("notsealed")).toThrow();
  });

  it("缺密钥时 seal 抛错", () => {
    const old = process.env.PLATFORM_CRED_ENC_KEY;
    process.env.PLATFORM_CRED_ENC_KEY = "";
    expect(() => box.seal("x")).toThrow(/PLATFORM_CRED_ENC_KEY/);
    process.env.PLATFORM_CRED_ENC_KEY = old;
  });
});
