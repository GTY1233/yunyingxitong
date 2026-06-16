// 仓储层集成测试：每次跑都建一个全新的临时 SQLite 库(prisma/test.db),
// 不碰 data/app.db。CI 安全(prisma db push 本地建表,无需网络)。
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_DB = path.join(process.cwd(), "prisma", "test.db");

// 必须在 repos 首次 getPrisma() 之前设好,故用动态 import。
process.env.DATABASE_URL = "file:./test.db";
const repos = (await import("../lib/repositories/index.js")).default;
const engine = (await import("../lib/workflow/service.js")).default;

beforeAll(() => {
  // 测试不调真实文案 API,强制模板兜底(本地 .env 可能带 COPY_API_KEY)
  process.env.COPY_API_KEY = "";
  for (const f of [TEST_DB, `${TEST_DB}-journal`]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  // 用 schema 建表到测试库
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "ignore",
  });
}, 60000);

afterAll(async () => {
  await repos.client.disconnect();
  for (const f of [TEST_DB, `${TEST_DB}-journal`]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
});

describe("仓储层 CRUD + 派生状态(对临时库)", () => {
  let productId = "";

  it("初始为空", async () => {
    expect(await repos.products.list()).toEqual([]);
    expect(await repos.accounts.list()).toEqual([]);
  });

  it("创建账号 + 按角色筛选", async () => {
    await repos.accounts.create({
      name: "授权号X",
      platform: "抖音",
      type: "内容账号",
      role: "authorized",
      auth: "已授权",
    });
    await repos.accounts.create({
      name: "达人Y",
      platform: "抖音",
      type: "内容账号",
      role: "creator",
      auth: "已授权",
    });
    expect((await repos.accounts.byRole("authorized")).length).toBe(1);
    expect((await repos.accounts.byRole("creator")).length).toBe(1);
  });

  it("创建商品并能读回", async () => {
    const p = await repos.products.create({
      displayCode: "T001",
      name: "测试商品",
      priceCents: 1999,
      stock: 5,
      platforms: JSON.stringify(["抖音"]),
      status: "待发布",
    });
    productId = p.id;
    expect(p.id).toBeTruthy();
    expect((await repos.products.list()).length).toBe(1);
    const got = await repos.products.getByDisplayCode("T001");
    expect(got.name).toBe("测试商品");
    expect(got.priceCents).toBe(1999);
    expect(got.createdAt).toBeInstanceOf(Date); // 真实时间戳
  });

  it("不传编号时自动生成 P 编号", async () => {
    const p = await repos.products.create({ name: "无编号商品", stock: 1 });
    expect(p.displayCode).toMatch(/^P\d+$/);
    await repos.products.softDelete(p.id); // 清理,避免影响后续计数断言
  });

  it("派生状态:加一张已生成图片后 imageStatus=已生成", async () => {
    let st = await repos.status.deriveProductMediaStatus(productId);
    expect(st.imageStatus).toBe("未生成");
    await repos.assets.create({ productId, kind: "image", status: "已生成", name: "主图" });
    st = await repos.status.deriveProductMediaStatus(productId);
    expect(st.imageStatus).toBe("已生成");
    expect(st.videoStatus).toBe("未生成");
  });

  it("更新商品", async () => {
    const updated = await repos.products.update(productId, { stock: 99 });
    expect(updated.stock).toBe(99);
  });

  it("软删除后不出现在 list", async () => {
    await repos.products.softDelete(productId);
    expect((await repos.products.list()).length).toBe(0);
    // 但记录仍在(仅打了 deletedAt)
    expect(await repos.products.getById(productId)).not.toBeNull();
  });
});

describe("工作流引擎(对临时库)", () => {
  it("创建淘宝工作流并逐节点推进到已完成", async () => {
    const p = await repos.products.create({ name: "工作流商品", stock: 10 });
    let wf = await engine.createForProduct(p.id, "淘宝");
    expect(wf.nodes.length).toBe(6);
    expect(wf.nodes[0].status).toBe("已成功"); // 商品资料自动完成
    expect(wf.nodes[1].status).toBe("可执行");
    expect(wf.progress).toBe(17);

    let guard = 0;
    while (wf.status !== "已完成" && guard++ < 12) {
      const node = wf.nodes.find((n) => !["已成功", "已跳过"].includes(n.status));
      const action = node.status === "可执行" ? "execute" : "confirm";
      wf = await engine.act(wf.id, node.id, action);
    }
    expect(wf.status).toBe("已完成");
    expect(wf.progress).toBe(100);
  });

  it("同商品同平台重复创建被拒", async () => {
    const p = await repos.products.create({ name: "重复流商品", stock: 1 });
    await engine.createForProduct(p.id, "抖音");
    await expect(engine.createForProduct(p.id, "抖音")).rejects.toThrow(/已有进行中/);
  });

  it("非法动作抛错(对待确认节点 execute)", async () => {
    const p = await repos.products.create({ name: "非法动作商品", stock: 1 });
    const wf = await engine.createForProduct(p.id, "小红书");
    // 推进到一个 manual(待确认)节点
    let cur = wf;
    let guard = 0;
    while (guard++ < 12) {
      const node = cur.nodes.find((n) => !["已成功", "已跳过"].includes(n.status));
      if (node.status === "待确认") {
        await expect(engine.act(cur.id, node.id, "execute")).rejects.toThrow();
        return;
      }
      cur = await engine.act(cur.id, node.id, "execute");
    }
    throw new Error("未遇到待确认节点");
  });
});
