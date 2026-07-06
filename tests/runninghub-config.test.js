// RunningHub 换装图/视频工作流的 app 与节点映射断言(离线,零上传零花钱)。
// 用公网 URL 作素材:resolveRunningHubMediaValue 对公网 URL 原样返回,不触发上传,不需要 KEY。
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_GENERATION_TEMPLATES } from "../lib/generation-template-service.js";
import imageAdapter from "../lib/image-adapter.js";
import { overrideVideoDefaults } from "../lib/video-adapter.js";
import videoAdapter from "../lib/video-adapter.js";

// 确保「公网URL原样返回」而非上传:默认即如此(RUNNINGHUB_UPLOAD_REMOTE_URL 未设为 "1")
beforeEach(() => {
  delete process.env.RUNNINGHUB_UPLOAD_REMOTE_URL;
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
    expect(n["105"]).toMatchObject({ fieldName: "select", fieldValue: "2" }); // 姿势
    expect(n["120"].fieldValue).toBe("4"); // 胸部
    expect(n["114"].fieldValue).toBe("2"); // 腰臀比
    expect(n["131"].fieldValue).toBe("1"); // 输出方式
    // 不应残留旧工作流节点
    expect(n["41"]).toBeUndefined();
    expect(n["79"]).toBeUndefined();
    expect(n["68"]).toBeUndefined();
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

  it("参数覆盖:帧率→264、表情→265、胸部抖动→266、秒数→加载帧上限422(=秒×帧率)", () => {
    const defaults = [
      { nodeId: "264", fieldName: "value", fieldValue: "30" },
      { nodeId: "265", fieldName: "value", fieldValue: "0.8" },
      { nodeId: "266", fieldName: "value", fieldValue: "0.2" },
      { nodeId: "422", fieldName: "value", fieldValue: "840" },
    ];
    const out = byNode(
      overrideVideoDefaults(defaults, {
        frameRate: "30",
        expressionIntensity: "0.9",
        ruKilnAmplitude: "0.35",
        seconds: "7",
      })
    );
    expect(out["264"].fieldValue).toBe("30");
    expect(out["265"].fieldValue).toBe("0.9");
    expect(out["266"].fieldValue).toBe("0.35");
    expect(out["422"].fieldValue).toBe("210"); // 7 × 30
  });

  it("未传参数时保留工作流默认值(不被空串覆盖)", () => {
    const defaults = [{ nodeId: "264", fieldName: "value", fieldValue: "30" }];
    const out = byNode(overrideVideoDefaults(defaults, {}));
    expect(out["264"].fieldValue).toBe("30");
  });

  it("视频模板默认已去掉像素宽高/mode(避免污染新工作流的比例节点)", () => {
    expect(VID_TPL.defaults.videoWidth).toBeUndefined();
    expect(VID_TPL.defaults.videoHeight).toBeUndefined();
    expect(VID_TPL.defaults.mode).toBeUndefined();
    expect(VID_TPL.defaults.frameRate).toBe("30");
  });
});
