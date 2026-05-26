const CAPABILITY_LEVELS = {
  export: 1,
  semiAuto: 2,
  autoPublish: 3,
  autoListing: 4,
  dataSync: 5,
};

const CAPABILITY_LABELS = {
  export: "导出发布",
  semiAuto: "半自动发布",
  autoPublish: "自动发布",
  autoListing: "自动上架",
  dataSync: "数据回流",
};

function highestCapability(capabilities = {}) {
  const order = ["dataSync", "autoListing", "autoPublish", "semiAuto", "export"];
  return order.find((key) => capabilities[key]) || "export";
}

function capabilitySummary(capabilities = {}) {
  return Object.keys(CAPABILITY_LABELS)
    .filter((key) => capabilities[key])
    .map((key) => CAPABILITY_LABELS[key]);
}

module.exports = {
  CAPABILITY_LEVELS,
  CAPABILITY_LABELS,
  highestCapability,
  capabilitySummary,
};
