function defaultGenerationParams(kind, product) {
  if (kind === "copy") {
    return {
      copyType: "发布文案",
      platform: product.platforms?.[0] || "抖音",
      versionCount: 3,
      extraPrompt: "不要夸大宣传，强调使用场景和购买理由。",
    };
  }
  if (kind === "image") {
    return {
      imageType: "商品主图",
      imageSize: "1:1 平台主图",
      imageCount: 4,
      extraPrompt: "真实商品质感，干净背景，突出核心卖点。",
    };
  }
  return {
    videoType: "商品展示视频",
    videoRatio: "9:16 竖版",
    videoDuration: "7 秒",
    seconds: "7",
    frameRate: "25",
    videoWidth: "544",
    videoHeight: "960",
    mode: "1",
    expressionIntensity: "1.0",
    ruKilnAmplitude: "0.2",
    extraPrompt: "",
  };
}

module.exports = {
  defaultGenerationParams,
};
