const { isPlatformDemoMode, demoExternalId } = require("./platform-demo");

const OBSERVE_KEYS = {
  observe_authorized: {
    label: "授权号橱窗同步",
    channel: "authorized_window",
    expectMinutes: 10,
  },
  observe_alliance: {
    label: "精选联盟推广",
    channel: "alliance",
    expectMinutes: 30,
  },
  data_done: {
    label: "数据回流",
    channel: "data",
    expectMinutes: 0,
  },
};

function findPlatformListing(db, productId, platform) {
  return (db.listingTasks || []).find(
    (item) => item.productId === productId && item.platform === platform && item.status === "已上架"
  );
}

function checkObserveNode(db, instance, node) {
  const meta = OBSERVE_KEYS[node.key] || { label: node.label, channel: "manual" };
  const product = (db.products || []).find((item) => item.id === instance.productId);
  const listing = findPlatformListing(db, instance.productId, instance.platform);
  const platformProductId =
    product?.platformProductIds?.[instance.platform] || listing?.externalId || "";

  if (!listing && node.key !== "data_done") {
    return {
      ok: false,
      status: "等待主店上架",
      message: "请先完成主店上架，再检查同步状态",
      channel: meta.channel,
    };
  }

  if (isPlatformDemoMode()) {
    const syncId = demoExternalId(instance.platform, meta.channel.slice(0, 3).toUpperCase());
    return {
      ok: true,
      demoMode: true,
      status: "已同步",
      message: `[演示] ${meta.label}：平台侧状态已就绪（约 ${meta.expectMinutes || 0} 分钟内生效）`,
      channel: meta.channel,
      platformProductId: platformProductId || syncId,
      checkedAt: new Date().toISOString(),
      autoConfirm: node.key === "data_done",
    };
  }

  return {
    ok: true,
    status: "待人工确认",
    message: `${meta.label}：请在平台后台确认后点击「确认并继续」`,
    channel: meta.channel,
    platformProductId,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  OBSERVE_KEYS,
  checkObserveNode,
  findPlatformListing,
};
