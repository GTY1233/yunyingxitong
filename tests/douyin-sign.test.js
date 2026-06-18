import { describe, expect, it } from "vitest";
import { buildSignedParams, md5Sign, stableSortedJson } from "../lib/platform/douyin/sign.js";

describe("抖店签名工具(纯函数)", () => {
  it("stableSortedJson 按 key 升序、数组顺序保留", () => {
    expect(stableSortedJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableSortedJson({ z: { y: 1, x: 2 }, a: [3, 1] })).toBe(
      '{"a":[3,1],"z":{"x":2,"y":1}}'
    );
  });

  it("md5Sign 确定性(同输入同输出)", () => {
    const s1 = md5Sign("ak", "sk", "product.addV2", '{"a":1}', "2026-06-18 10:00:00");
    const s2 = md5Sign("ak", "sk", "product.addV2", '{"a":1}', "2026-06-18 10:00:00");
    expect(s1).toBe(s2);
    expect(s1).toMatch(/^[0-9a-f]{32}$/); // MD5 hex
  });

  it("md5Sign 对入参敏感", () => {
    const base = md5Sign("ak", "sk", "m", "{}", "t");
    expect(md5Sign("ak2", "sk", "m", "{}", "t")).not.toBe(base);
    expect(md5Sign("ak", "sk", "m2", "{}", "t")).not.toBe(base);
  });

  it("buildSignedParams 组装公共参数", () => {
    const p = buildSignedParams({
      appKey: "ak",
      appSecret: "sk",
      accessToken: "tok",
      method: "product.addV2",
      params: { b: 1, a: 2 },
      timestamp: "2026-06-18 10:00:00",
    });
    expect(p.app_key).toBe("ak");
    expect(p.access_token).toBe("tok");
    expect(p.method).toBe("product.addV2");
    expect(p.param_json).toBe('{"a":2,"b":1}');
    expect(p.v).toBe("2");
    expect(p.sign).toMatch(/^[0-9a-f]{32}$/);
  });
});
