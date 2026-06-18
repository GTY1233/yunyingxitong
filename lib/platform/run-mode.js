// 三态运行模式解析:demo(演示假成功)/ real(真调平台)/ manual(产出人工任务包)。
// 关键安全设计:想 real 但凭证不全 → 降级 manual(给人工任务包),绝不降级 demo(假成功误导)。
function hasUsableRealCred(cred) {
  return Boolean(
    cred?.appKey && cred.appSecretEnc && cred.accessTokenEnc && cred.status === "已授权"
  );
}

function resolveRunMode(cred) {
  if (process.env.PLATFORM_FORCE_DEMO === "1") return "demo";
  const want = cred?.runMode || process.env.DOUYIN_RUN_MODE || "demo";
  if (want === "real") return hasUsableRealCred(cred) ? "real" : "manual";
  return want === "manual" ? "manual" : "demo";
}

module.exports = { resolveRunMode, hasUsableRealCred };
