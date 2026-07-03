// 合规引擎单测(纯函数,不碰库/网络)。规则数据见 lib/compliance/rules.js。
import { describe, expect, it } from "vitest";
import {
  appendAiLabel,
  buildPromptRules,
  checkProductForListing,
  checkText,
  getRules,
  sanitizeText,
} from "../lib/compliance/engine.js";

const douyin = getRules("抖音");

describe("合规引擎:文本扫描与净化", () => {
  it("命中禁售款词与低俗词,类型区分正确", () => {
    const v = checkText("性感半透明丁字裤,充满诱惑", douyin);
    const types = new Set(v.map((x) => x.type));
    expect(types.has("banned_product")).toBe(true); // 半透明/丁字裤
    expect(types.has("vulgar")).toBe(true); // 性感/诱惑
  });

  it("干净文本零违规", () => {
    expect(checkText("蕾丝套装 纯欲风 辣妹穿搭 ootd", douyin)).toEqual([]);
  });

  it("净化:敏感词换中性词,长词优先(情趣内衣→蕾丝套装,而非先换情趣)", () => {
    const s = sanitizeText("这款情趣内衣很性感", douyin);
    expect(s.text).toContain("蕾丝套装");
    expect(s.text).toContain("纯欲风");
    expect(s.text).not.toContain("情趣");
    expect(s.text).not.toContain("性感");
    expect(s.replaced.length).toBeGreaterThan(0);
  });

  it("净化不处理禁售款词(那是商品问题,不是措辞问题)", () => {
    const s = sanitizeText("开裆款式", douyin);
    expect(s.text).toContain("开裆"); // 不替换
  });
});

describe("合规引擎:上架闸门", () => {
  it("禁售款词命中 → 拦截并说明字段与词", () => {
    const r = checkProductForListing({ name: "半透明蕾丝内裤" }, douyin);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/禁售/);
    expect(r.message).toMatch(/半透明/);
  });

  it("低俗词命中 → 拦截并给中性词建议", () => {
    const r = checkProductForListing({ name: "蕾丝套装", sellingPoints: "性感诱惑" }, douyin);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/纯欲风/);
  });

  it("干净商品放行", () => {
    const r = checkProductForListing(
      { name: "法式蕾丝睡裙", sellingPoints: "面料舒适,氛围感拉满" },
      douyin
    );
    expect(r.ok).toBe(true);
  });

  it("规则按平台隔离:未配置平台(淘宝)不套抖音红线", () => {
    const r = checkProductForListing({ name: "性感内衣" }, getRules("淘宝"));
    expect(r.ok).toBe(true); // 淘宝走 DEFAULT,无抖音词表
  });
});

describe("合规引擎:prompt 注入与 AIGC 标识", () => {
  it("抖音规则生成 prompt 红线块", () => {
    const block = buildPromptRules(douyin);
    expect(block).toMatch(/合规红线/);
    expect(block).toMatch(/纯欲风/);
  });

  it("AI 标识追加且幂等", () => {
    const once = appendAiLabel("文案", douyin);
    expect(once).toMatch(/AI辅助生成/);
    expect(appendAiLabel(once, douyin)).toBe(once); // 不重复追加
  });
});
