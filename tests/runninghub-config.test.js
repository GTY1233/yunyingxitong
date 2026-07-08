// RunningHub 换装图/视频工作流的 app 与节点映射断言(离线,零上传零花钱)。
// 用公网 URL 作素材:resolveRunningHubMediaValue 对公网 URL 原样返回,不触发上传,不需要 KEY。
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_GENERATION_TEMPLATES } from "../lib/generation-template-service.js";
import imageAdapter from "../lib/image-adapter.js";
import { overrideVideoDefaults } from "../lib/video-adapter.js";
import videoAdapter from "../lib/video-adapter.js";

// 确保「公网URL原样返回」而非上传:非 "1" 即原样(不触发上传/不需要 KEY)
beforeEach(() => {
  process.env.RUNNINGHUB_UPLOAD_REMOTE_URL = "";
});

const IMG_TPL = DEFAULT_GENERATION_TEMPLATES.find((t) => t.kind === "image");
const VID_TPL = DEFAULT_GENERATION_TEMPLATES.find((t) => t.kind === "video");
const MODEL = "https://example.com/model.png";
const CLOTH = "https://example.com/cloth.jpg";
const REFIMG = "https://example.com/ref.png";
const REFVID = "https://example.com/ref.mp4";

function byNode(list) {
  return Object.fromEntries(list.map((n) => [n.nodeId, n]));
}

describe("换装图工作流:app 与节点映射", () => {
  it("app 换成 2034233561917689858", () => {
    expect(IMG_TPL.runningHub.appId).toBe("2034233561917689858");
  });

  it("构建的 nodeInfoList:22=模特图 / 23=商品图 / 102=提示词(text) / 105·120·114·131 调参", async () => {
    const list = await imageAdapter.buildAiAppImageNodeInfo(
      { name: "睡裙" },
      {
        runningHub: IMG_TPL.runningHub,
        modelImageUrls: [MODEL],
        referenceImageUrls: [CLOTH],
        extraPrompt: "把图1角色的服装换成图2的服装",
      },
      {}
    );
    const n = byNode(list);
    expect(n["22"]).toMatchObject({ fieldName: "image", fieldValue: MODEL }); // 人物
    expect(n["23"]).toMatchObject({ fieldName: "image", fieldValue: CLOTH }); // 服装
    expect(n["102"]).toMatchObject({ fieldName: "text" }); // 提示词用 text
    expect(n["102"].fieldValue).toContain("换成图2");
    // 默认档位对齐工作流界面(全 1:保持原姿势/默认不改变/标准/直出)
    expect(n["105"]).toMatchObject({ fieldName: "select", fieldValue: "1" }); // 姿势
    expect(n["120"].fieldValue).toBe("1"); // 胸部
    expect(n["114"].fieldValue).toBe("1"); // 腰臀比
    expect(n["131"].fieldValue).toBe("1"); // 输出方式
    // 不应残留旧工作流节点
    expect(n["41"]).toBeUndefined();
    expect(n["79"]).toBeUndefined();
    expect(n["68"]).toBeUndefined();
  });

  it("用户选档位覆盖到节点:胸部D/E饱满纯欲(120=2)、腰臀比强化(114=2)、ZIP输出(131=2)", async () => {
    const list = await imageAdapter.buildAiAppImageNodeInfo(
      { name: "睡裙" },
      {
        runningHub: IMG_TPL.runningHub,
        modelImageUrls: [MODEL],
        referenceImageUrls: [CLOTH],
        poseMode: "2", // 站立姿势
        chestMode: "2", // D/E 饱满纯欲不夸张
        waistHipMode: "2", // 强化
        outputMode: "2", // ZIP
      },
      {}
    );
    const n = byNode(list);
    expect(n["105"].fieldValue).toBe("2");
    expect(n["120"].fieldValue).toBe("2");
    expect(n["114"].fieldValue).toBe("2");
    expect(n["131"].fieldValue).toBe("2");
  });

  it("overrideImageDefaults:未传的档位保留默认,不被空串覆盖", () => {
    const base = [
      { nodeId: "105", fieldValue: "1" },
      { nodeId: "120", fieldValue: "1" },
    ];
    const out = byNode(imageAdapter.overrideImageDefaults(base, { chestMode: "3" }));
    expect(out["105"].fieldValue).toBe("1"); // 未传 → 保留
    expect(out["120"].fieldValue).toBe("3"); // 传了 → 覆盖
  });
});

describe("视频工作流:app 与节点映射", () => {
  it("app 换成 1975951975441412098", () => {
    expect(VID_TPL.runningHub.appId).toBe("1975951975441412098");
  });

  it("构建的 nodeInfoList:299=参考图片(image) / 275=参考视频(video)", async () => {
    const list = await videoAdapter.buildAiAppVideoNodeInfo(
      { name: "睡裙", sellingPoints: "蕾丝" },
      {
        runningHub: VID_TPL.runningHub,
        referenceImageUrls: [REFIMG],
        referenceVideoUrl: REFVID,
        ...VID_TPL.defaults,
      },
      {}
    );
    const n = byNode(list);
    expect(n["299"]).toMatchObject({ fieldName: "image", fieldValue: REFIMG }); // 参考图片
    expect(n["275"]).toMatchObject({ fieldName: "video", fieldValue: REFVID }); // 参考视频
    // 不应残留旧工作流节点
    expect(n["103"]).toBeUndefined();
    expect(n["161"]).toBeUndefined();
  });

  it("全量参数覆盖:数值/档位/开关(bool→true/false)各映射到对应节点", () => {
    const defaults = [
      { nodeId: "264", fieldValue: "30" }, // 帧率
      { nodeId: "265", fieldValue: "0.6" }, // 表情
      { nodeId: "266", fieldValue: "0.27" }, // 胸部抖动
      { nodeId: "297", fieldValue: "1.0" }, // 姿势强度
      { nodeId: "370", fieldValue: "false" }, // 运镜开关
      { nodeId: "422", fieldValue: "840" }, // 加载帧上限
      { nodeId: "470", fieldValue: "2" }, // 分辨率
      { nodeId: "452", fieldValue: "false" }, // 自定义比例
    ];
    const out = byNode(
      overrideVideoDefaults(defaults, {
        frameRate: 30,
        expressionIntensity: 0.9,
        ruKilnAmplitude: 0.35,
        poseStrength: 1.5,
        cameraMove: true, // 开关 → "true"
        maxFrames: 300, // 加载帧上限直接设
        resolution: "1", // 分辨率档位
        customRatio: false, // 开关 → "false"
      })
    );
    expect(out["264"].fieldValue).toBe("30");
    expect(out["265"].fieldValue).toBe("0.9");
    expect(out["266"].fieldValue).toBe("0.35");
    expect(out["297"].fieldValue).toBe("1.5");
    expect(out["370"].fieldValue).toBe("true"); // bool 转字符串
    expect(out["422"].fieldValue).toBe("300");
    expect(out["470"].fieldValue).toBe("1");
    expect(out["452"].fieldValue).toBe("false");
  });

  it("未传参数时保留工作流默认值(不被空串覆盖)", () => {
    const defaults = [{ nodeId: "264", fieldValue: "30" }];
    const out = byNode(overrideVideoDefaults(defaults, {}));
    expect(out["264"].fieldValue).toBe("30");
  });

  it("视频调参默认全部在 nodeInfoDefaults(模板 defaults 只留展示字段)", () => {
    const nodeIds = VID_TPL.runningHub.nodeInfoDefaults.map((n) => n.nodeId);
    expect(nodeIds).toEqual(
      expect.arrayContaining(["264", "265", "266", "297", "370", "422", "470", "452"])
    );
    expect(VID_TPL.defaults.frameRate).toBeUndefined(); // 已移出模板
    expect(VID_TPL.defaults.videoWidth).toBeUndefined();
  });
});
