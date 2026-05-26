const { createAdapter } = require("./adapter-factory");
const douyin = require("./adapters/douyin");
const xiaohongshu = require("./adapters/xiaohongshu");
const taobao = require("./adapters/taobao");
const pinduoduo = require("./adapters/pinduoduo");

const defaultAdapter = createAdapter({
  platform: "默认",
  capabilities: {
    export: true,
    semiAuto: false,
    autoPublish: false,
    autoListing: false,
    dataSync: false,
  },
  publishHandler() {
    return {
      ok: false,
      error: "该平台尚未接入 API，请使用导出发布",
      capability: "export",
      fallback: "export",
    };
  },
  listingHandler() {
    return {
      ok: false,
      error: "该平台尚未接入 API，请导出上架草稿",
      capability: "export",
      fallback: "export",
    };
  },
});

const ADAPTERS = [douyin, xiaohongshu, taobao, pinduoduo];

function getPlatformAdapter(platformName) {
  const name = String(platformName || "").trim();
  return ADAPTERS.find((item) => item.platform === name) || { ...defaultAdapter, platform: name || "未知平台" };
}

function listPlatformCapabilities() {
  return ADAPTERS.map((adapter) => ({
    platform: adapter.platform,
    capabilities: adapter.capabilities,
    hasLiveApi: adapter.hasLiveApi(),
    envKey: adapter.envKey || "",
    highest: require("./capabilities").highestCapability(adapter.capabilities),
    summary: require("./capabilities").capabilitySummary(adapter.capabilities),
  }));
}

module.exports = {
  getPlatformAdapter,
  listPlatformCapabilities,
  ADAPTERS,
};
