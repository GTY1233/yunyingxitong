// 抖音平台适配器。统一三态(demo/real/manual)同签名;real 调 shop-client(暂抛待接入)。
const crypto = require("node:crypto");
const { callShopApi } = require("./shop-client");

function demoExternalId(prefix) {
  return `${prefix}-DEMO-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function capabilities() {
  return {
    platform: "抖音",
    listing: { real: "api", demo: true, manual: true }, // 主店上架:官方 API 可行
    windowSync: { real: "observe-only", demo: true, manual: true }, // 授权号橱窗:平台原生,只观测
    publish: { real: "rpa", demo: true, manual: true }, // 视频挂车:官方 API 不可得,RPA/手动
  };
}

// 主店上架。返回 { ok, mode, externalId?, response?, manualTask? }
async function createListing(payload, { mode, creds }) {
  if (mode === "demo") {
    return {
      ok: true,
      mode: "demo",
      externalId: demoExternalId("抖音商品"),
      response: { demo: true, steps: ["product.addV2"] },
    };
  }
  if (mode === "manual") {
    return {
      ok: true,
      mode: "manual",
      manualTask: {
        type: "抖店主店上架",
        steps: ["登录抖店后台", "商品 → 发布新品", "按下方字段填写并上传主图/详情图", "提交审核"],
        payload,
      },
    };
  }
  const res = await callShopApi("product.addV2", payload, creds); // real:暂抛 NOT_IMPLEMENTED
  return { ok: true, mode: "real", externalId: res.product_id, response: res };
}

// 观测授权号橱窗/精选联盟同步(只读)。抖店很可能无查询 API → real 也返人工核对。
async function observeWindowSync(_externalId, { mode }) {
  if (mode === "demo") return { ok: true, mode: "demo", synced: true };
  return {
    ok: true,
    mode,
    synced: false,
    manualTask: {
      type: "核对橱窗/联盟",
      steps: ["抖店后台 → 授权号橱窗/精选联盟", "确认商品已出现"],
    },
  };
}

// 矩阵号视频发布+挂车。官方 API 不可得 → 除 demo 外都产人工/RPA 任务包。
async function publishVideo(input, { mode }) {
  if (mode === "demo") {
    return { ok: true, mode: "demo", externalId: demoExternalId("抖音视频") };
  }
  return {
    ok: true,
    mode: "manual",
    manualTask: {
      type: "视频发布挂车",
      steps: ["对应账号登录创作者中心", "发布视频", "添加商品 → 选橱窗/联盟商品"],
      input,
    },
  };
}

module.exports = { capabilities, createListing, observeWindowSync, publishVideo };
