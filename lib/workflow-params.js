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
      // 不在此塞通用提示词,否则会盖掉换装模板的 promptHint(node68 换装指令)。
      // 留空 → mergeGenerationParams 会采用模板的换装默认词;UI 也可手动覆盖。
      extraPrompt: "",
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
