import { describe, expect, it } from "vitest";
import { accountCanPublish, dailyPublishCount, parseDailyLimit } from "../lib/account-utils.js";

describe("parseDailyLimit", () => {
  it("从规则文本解析每日条数", () => {
    expect(parseDailyLimit("每天最多3条")).toBe(3);
    expect(parseDailyLimit("日发布上限 5 条")).toBe(5);
  });
  it("无数字或空规则返回 0", () => {
    expect(parseDailyLimit("")).toBe(0);
    expect(parseDailyLimit(null)).toBe(0);
    expect(parseDailyLimit("不限量")).toBe(0);
  });
});

describe("dailyPublishCount", () => {
  const db = {
    publishTasks: [
      { accountId: "A1", scheduleSlot: "今天", status: "待发布" },
      { accountId: "A1", scheduleSlot: "今天", status: "已成功" },
      { accountId: "A1", scheduleSlot: "今天", status: "已暂停" }, // 无效状态不计入
      { accountId: "A1", scheduleSlot: "明天", status: "待发布" }, // 不同档位不计入
      { accountId: "A2", scheduleSlot: "今天", status: "待发布" },
    ],
  };
  it("只统计指定账号 + 档位 + 有效状态", () => {
    expect(dailyPublishCount(db, "A1", "今天")).toBe(2);
    expect(dailyPublishCount(db, "A1", "明天")).toBe(1);
    expect(dailyPublishCount(db, "A2", "今天")).toBe(1);
    expect(dailyPublishCount(db, "未知账号", "今天")).toBe(0);
  });
});

describe("accountCanPublish (授权态分支)", () => {
  it("已授权账号可发布", () => {
    expect(accountCanPublish({ auth: "已授权" })).toEqual({ ok: true });
  });
  it("授权失效 / 未授权不可发布", () => {
    expect(accountCanPublish({ auth: "授权已失效" }).ok).toBe(false);
    expect(accountCanPublish({ auth: "未授权" }).ok).toBe(false);
  });
  it("即将过期可发布但带告警", () => {
    const r = accountCanPublish({ auth: "授权即将过期" });
    expect(r.ok).toBe(true);
    expect(r.warn).toBeTruthy();
  });
});
