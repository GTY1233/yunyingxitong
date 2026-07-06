// 发布链路离线单测:载荷组装(纯逻辑)、social-auto-upload 命令构造、三态判定。
// 不真跑 sau、不联网、不花钱。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deriveTags, splitTitleDesc } from "../lib/publish/publish-payload.js";
import { buildArgs, canRealPublish, mapPlatform } from "../lib/publish/social-uploader.js";

const ENV = ["SAU_ENABLED", "SAU_CLI", "SAU_CWD"];
const saved = {};
beforeEach(() => {
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("发布载荷:标题/正文/标签派生", () => {
  it("标题取文案首行(去#、截30字),正文取整段", () => {
    const { title, desc } = splitTitleDesc("蕾丝睡裙上身超好看 #纯欲风\n第二行正文", {
      name: "睡裙",
    });
    expect(title).toBe("蕾丝睡裙上身超好看");
    expect(desc).toContain("第二行正文");
  });

  it("无文案时用商品名兜底", () => {
    const { title } = splitTitleDesc("", { name: "法式睡裙", sellingPoints: "蕾丝" });
    expect(title).toBe("法式睡裙");
  });

  it("标签从#话题+类目+短卖点派生,去重、≤6", () => {
    const tags = deriveTags("好物 #纯欲风 #辣妹穿搭", {
      category: "睡裙",
      sellingPoints: "蕾丝,亲肤,显瘦",
    });
    expect(tags).toContain("纯欲风");
    expect(tags).toContain("睡裙");
    expect(tags).toContain("蕾丝");
    expect(new Set(tags).size).toBe(tags.length); // 去重
    expect(tags.length).toBeLessThanOrEqual(6);
  });
});

describe("social-auto-upload:平台映射与命令构造", () => {
  it("平台名映射:抖音→douyin、小红书→xiaohongshu、未知→空", () => {
    expect(mapPlatform("抖音")).toBe("douyin");
    expect(mapPlatform("小红书")).toBe("xiaohongshu");
    expect(mapPlatform("淘宝")).toBe("");
  });

  it("命令参数:sau douyin upload-video --account 名 --file 路径 --title.. --desc.. --tags..", () => {
    const args = buildArgs(
      { videoPath: "/abs/v.mp4", title: "标题", desc: "正文", tags: ["纯欲风", "睡裙"] },
      { platform: "抖音", account: { publishHandle: "dy_main" } }
    );
    expect(args.slice(0, 4)).toEqual(["douyin", "upload-video", "--account", "dy_main"]);
    expect(args).toContain("--file");
    expect(args[args.indexOf("--file") + 1]).toBe("/abs/v.mp4");
    expect(args[args.indexOf("--title") + 1]).toBe("标题");
    expect(args[args.indexOf("--tags") + 1]).toBe("纯欲风,睡裙");
  });

  it("账号无 publishHandle 时回退用 name;都没有则抛", () => {
    const args = buildArgs(
      { videoPath: "/v.mp4", title: "t" },
      { platform: "抖音", account: { name: "备用号" } }
    );
    expect(args[args.indexOf("--account") + 1]).toBe("备用号");
    expect(() => buildArgs({ videoPath: "/v.mp4" }, { platform: "抖音", account: {} })).toThrow();
  });

  it("不支持的平台抛错", () => {
    expect(() =>
      buildArgs({ videoPath: "/v.mp4" }, { platform: "淘宝", account: { name: "x" } })
    ).toThrow(/不支持平台/);
  });
});

describe("三态判定 canRealPublish", () => {
  const acc = { name: "号", publishHandle: "dy1" };
  it("未开启 SAU → 不能真发(走导出/人工)", () => {
    expect(canRealPublish("抖音", acc)).toBe(false);
  });
  it("开启 + 平台可映射 + 账号有发布名 → 可真发", () => {
    process.env.SAU_ENABLED = "1";
    expect(canRealPublish("抖音", acc)).toBe(true);
  });
  it("开启但平台不支持 → 不能真发", () => {
    process.env.SAU_ENABLED = "1";
    expect(canRealPublish("淘宝", acc)).toBe(false);
  });
  it("开启但账号无发布名/名字 → 不能真发", () => {
    process.env.SAU_ENABLED = "1";
    expect(canRealPublish("抖音", {})).toBe(false);
  });
});
