// 三态运行模式解析单测(发布安全护栏:想 real 但凭证不全必须降级 manual,绝不降 demo 假成功)。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasUsableRealCred, resolveRunMode } from "../lib/platform/run-mode.js";

const ENV_KEYS = ["PLATFORM_FORCE_DEMO", "DOUYIN_RUN_MODE"];
const saved = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const FULL_CRED = {
  appKey: "ak",
  appSecretEnc: "v1:x:y:z",
  accessTokenEnc: "v1:a:b:c",
  status: "已授权",
};

describe("hasUsableRealCred", () => {
  it("四要素齐全才算可用", () => {
    expect(hasUsableRealCred(FULL_CRED)).toBe(true);
    expect(hasUsableRealCred({ ...FULL_CRED, appKey: "" })).toBe(false);
    expect(hasUsableRealCred({ ...FULL_CRED, accessTokenEnc: null })).toBe(false);
    expect(hasUsableRealCred({ ...FULL_CRED, status: "未授权" })).toBe(false);
    expect(hasUsableRealCred(null)).toBe(false);
  });
});

describe("resolveRunMode 三态矩阵", () => {
  it("无凭证、无环境 → demo(演示假成功,可跑通流程)", () => {
    expect(resolveRunMode(null)).toBe("demo");
  });

  it("想 real 且凭证齐全 → real", () => {
    expect(resolveRunMode({ ...FULL_CRED, runMode: "real" })).toBe("real");
  });

  it("想 real 但凭证不全 → 降级 manual(产人工任务包),绝不降 demo 假成功", () => {
    expect(resolveRunMode({ runMode: "real", appKey: "ak", status: "未授权" })).toBe("manual");
  });

  it("显式 manual → manual", () => {
    expect(resolveRunMode({ ...FULL_CRED, runMode: "manual" })).toBe("manual");
  });

  it("环境默认 DOUYIN_RUN_MODE 生效(凭证未指定 runMode 时)", () => {
    process.env.DOUYIN_RUN_MODE = "manual";
    expect(resolveRunMode(null)).toBe("manual");
  });

  it("PLATFORM_FORCE_DEMO=1 强制演示,压过一切(联调保险丝)", () => {
    process.env.PLATFORM_FORCE_DEMO = "1";
    expect(resolveRunMode({ ...FULL_CRED, runMode: "real" })).toBe("demo");
  });
});
