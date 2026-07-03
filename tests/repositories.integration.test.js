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
const platformExec = (await import("../lib/workflow/platform-executors.js")).default;

beforeAll(() => {
  // 测试不调真实生成 API,强制模板兜底(本地 .env 可能带密钥)
  process.env.COPY_API_KEY = "";
  process.env.RUNNINGHUB_API_KEY = "";
  process.env.PLATFORM_CRED_ENC_KEY = "0".repeat(64); // 凭证加密测试用
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
    // 商品要够完整,create_listing 节点的完整度门槛才放行
    const p = await repos.products.create({
      name: "工作流商品",
      priceCents: 9900,
      stock: 10,
      sellingPoints: "好用又便宜",
    });
    await repos.assets.create({ productId: p.id, kind: "image", status: "已生成", name: "主图" });
    let wf = await engine.createForProduct(p.id, "淘宝");
    expect(wf.nodes.length).toBe(6);
    expect(wf.nodes[0].status).toBe("已成功"); // 商品资料自动完成
    expect(wf.nodes[1].status).toBe("可执行");
    expect(wf.progress).toBe(17);

    let guard = 0;
    while (wf.status !== "已完成" && guard++ < 12) {
      const node = wf.nodes.find((n) => !["已成功", "已跳过"].includes(n.status));
      const action = node.status === "可执行" ? "execute" : "confirm";
      wf = await engine.act(wf.id, node.id, action, { sync: true }); // sync:等待后台任务完成
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
      cur = await engine.act(cur.id, node.id, "execute", { sync: true });
    }
    throw new Error("未遇到待确认节点");
  });
});

describe("平台凭证仓储(加密落库,对临时库)", () => {
  it("appSecret 加密存、脱敏不漏、解密可还原", async () => {
    const c = await repos.credentials.upsertConfig({
      platform: "抖音",
      api: "douyin_shop",
      appKey: "ak_123",
      appSecret: "sk_super_secret",
    });
    // 库里存的是密文,不是明文
    expect(c.appSecretEnc).toBeTruthy();
    expect(c.appSecretEnc).not.toContain("sk_super_secret");
    expect(c.appSecretEnc.startsWith("v1:")).toBe(true);

    // 脱敏视图:只暴露「已配置」,不含明文/密文
    const masked = repos.credentials.maskView(c);
    expect(masked.appSecretSet).toBe(true);
    expect(JSON.stringify(masked)).not.toContain("sk_super_secret");
    expect("appSecret" in masked).toBe(false);

    // 解密只在内存:能还原明文
    const dec = await repos.credentials.getDecrypted(c.id);
    expect(dec.appKey).toBe("ak_123");
    expect(dec.appSecret).toBe("sk_super_secret");
  });

  it("upsert 同 (platform,api) 更新而非重复创建;saveTokens 加密+设过期+状态", async () => {
    const a = await repos.credentials.upsertConfig({
      platform: "抖音",
      api: "douyin_shop",
      appKey: "ak_v2",
    });
    const list1 = (await repos.credentials.list()).filter((x) => x.api === "douyin_shop");
    expect(list1.length).toBe(1); // 仍是 1 条
    expect(a.appKey).toBe("ak_v2");

    await repos.credentials.saveTokens(a.id, {
      accessToken: "at_xxx",
      refreshToken: "rt_xxx",
      shopId: "shop_9",
      expiresInSec: 7 * 86400,
    });
    const dec = await repos.credentials.getDecrypted(a.id);
    expect(dec.accessToken).toBe("at_xxx");
    expect(dec.shopId).toBe("shop_9");
    const after = await repos.credentials.getById(a.id);
    expect(after.status).toBe("已授权");
    expect(after.accessTokenEnc.startsWith("v1:")).toBe(true);
    expect(after.tokenExpiresAt).toBeInstanceOf(Date);
  });
});

describe("上架执行器(demo,对临时库)", () => {
  it("完整度不足 → 失败并提示缺什么", async () => {
    const p = await repos.products.create({ name: "缺料商品", stock: 1 });
    const r = await platformExec.executeListingNode(p, "抖音");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/不完整/);
  });

  it("完整商品 demo 上架 → 建映射,二次执行幂等跳过", async () => {
    const p = await repos.products.create({
      name: "可上架商品",
      priceCents: 5000,
      stock: 9,
      sellingPoints: "卖点",
    });
    await repos.assets.create({ productId: p.id, kind: "image", status: "已生成", name: "主图" });

    const r1 = await platformExec.executeListingNode(p, "抖音");
    expect(r1.ok).toBe(true);
    expect(r1.summary).toMatch(/演示上架成功/);

    const m = await repos.client.getPrisma().platformProductMapping.findUnique({
      where: { productId_platform: { productId: p.id, platform: "抖音" } },
    });
    expect(m).not.toBeNull();
    expect(m.externalProductId).toMatch(/^抖音商品-DEMO-/);

    const r2 = await platformExec.executeListingNode(p, "抖音");
    expect(r2.summary).toMatch(/跳过/);
  });
});

describe("自动流水线(autoMode,对临时库)", () => {
  it("创建即自动跑到审核点;确认后自动续跑;直至完成", async () => {
    const p = await repos.products.create({
      name: "自动流商品",
      priceCents: 8800,
      stock: 5,
      sellingPoints: "顺滑亲肤",
    });
    await repos.assets.create({ productId: p.id, kind: "image", status: "已生成", name: "主图" });

    // 淘宝链:资料(自动完成)→主图(生成)→文案(生成)→预览确认→上架→数据回流
    let wf = await engine.createForProduct(p.id, "淘宝", { autoMode: true, sync: true });
    expect(wf.autoMode).toBe(true);
    // 两个生成节点已被自动执行,链停在「预览确认」审核点
    let waiting = wf.nodes.find((n) => n.status === "待确认");
    expect(waiting?.label).toBe("预览确认");
    expect(wf.nodes.filter((n) => n.status === "已成功").length).toBe(3);

    // 人通过审核点 → 自动执行上架 → 停在「数据回流」观测点
    wf = await engine.act(wf.id, waiting.id, "confirm", { sync: true });
    expect(wf.nodes.find((n) => n.label === "店铺上架").status).toBe("已成功");
    waiting = wf.nodes.find((n) => n.status === "待确认");
    expect(waiting?.label).toBe("数据回流");

    // 最后一个观测点确认 → 全链完成
    wf = await engine.act(wf.id, waiting.id, "confirm", { sync: true });
    expect(wf.status).toBe("已完成");
    expect(wf.progress).toBe(100);
  });

  it("审核队列能看到停下来等人的节点", async () => {
    const p = await repos.products.create({
      name: "审核队列商品",
      priceCents: 6600,
      stock: 2,
      sellingPoints: "轻薄透气",
    });
    await repos.assets.create({ productId: p.id, kind: "image", status: "已生成", name: "主图" });
    const wf = await engine.createForProduct(p.id, "淘宝", { autoMode: true, sync: true });
    const q = await engine.reviewQueue();
    const mine = q.items.find((i) => i.workflowId === wf.id);
    expect(mine).toBeTruthy();
    expect(mine.status).toBe("待确认");
    expect(mine.nodeLabel).toBe("预览确认");
    expect(mine.productName).toBe("审核队列商品");
    expect(q.counts.pending).toBeGreaterThan(0);
  });
});

describe("上架合规闸门(抖音规则,对临时库)", () => {
  it("禁售款词/低俗词命中 → 合规拦截,不进上架", async () => {
    const p = await repos.products.create({
      name: "性感情趣内衣丁字裤",
      priceCents: 3000,
      stock: 3,
      sellingPoints: "诱惑",
    });
    await repos.assets.create({ productId: p.id, kind: "image", status: "已生成", name: "主图" });
    const r = await platformExec.executeListingNode(p, "抖音");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/合规拦截/);
    expect(r.error).toMatch(/丁字裤/);
  });

  it("文案生成产物:自动净化敏感词 + 追加 AI 标识 + 打 isAiGenerated", async () => {
    const p = await repos.products.create({
      name: "情趣内衣蕾丝款",
      priceCents: 4500,
      stock: 4,
      sellingPoints: "性感撩人",
      platforms: JSON.stringify(["抖音"]),
    });
    const wf = await engine.createForProduct(p.id, "抖音");
    const copyNode = wf.nodes.find((n) => n.kind === "copy");
    // 直推文案节点(跳过前面的图片节点直接测 copy 执行器)
    const executors = (await import("../lib/workflow/executors.js")).default;
    const r = await executors.executeGenerateNode(copyNode, p, {}, "抖音");
    expect(r.ok).toBe(true);
    const copies = await repos.assets.listByProduct(p.id, "copy");
    expect(copies.length).toBeGreaterThan(0);
    for (const c of copies) {
      expect(c.isAiGenerated).toBe(true);
      expect(c.content).toMatch(/AI辅助生成/); // 显式标识
      expect(c.content).not.toMatch(/情趣内衣/); // 敏感词已净化(模板文案含商品名)
    }
  });
});
