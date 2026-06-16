// 三平台工作流节点链(声明式配置,从旧 platform-workflow-engine 平移的领域知识)。
// 节点 type:manual(人工确认)/ generate(生成,可重试副作用)/ listing(上架)/ observe(等待平台同步)/ publish(矩阵发布)
const PLATFORM_CHAINS = {
  抖音: [
    { key: "product_info", label: "商品资料", type: "manual" },
    { key: "generate_image", label: "图片生成", type: "generate", kind: "image" },
    {
      key: "generate_copy",
      label: "商品文案",
      type: "generate",
      kind: "copy",
      params: { copyType: "详情文案" },
    },
    { key: "generate_video", label: "视频生成", type: "generate", kind: "video" },
    {
      key: "generate_video_copy",
      label: "视频文案",
      type: "generate",
      kind: "copy",
      params: { copyType: "发布文案" },
    },
    { key: "wait_confirm", label: "预览确认", type: "manual" },
    { key: "listing_confirm", label: "主店上架确认", type: "manual" },
    { key: "create_listing", label: "主店上架", type: "listing" },
    {
      key: "observe_authorized",
      label: "授权号橱窗同步",
      type: "observe",
      hint: "主店上架后,抖店后台开启授权号自动同步;此处确认橱窗已出现商品。",
    },
    {
      key: "observe_alliance",
      label: "精选联盟推广",
      type: "observe",
      hint: "确认新品已加入精选联盟自动推广。",
    },
    { key: "create_publish", label: "矩阵内容发布", type: "publish", multiAccount: true },
    { key: "data_done", label: "数据回流", type: "observe", hint: "发布完成后记录数据。" },
  ],
  小红书: [
    { key: "product_info", label: "商品资料", type: "manual" },
    {
      key: "generate_image",
      label: "图片生成",
      type: "generate",
      kind: "image",
      params: { imageType: "商品主图" },
    },
    {
      key: "generate_copy",
      label: "商品文案",
      type: "generate",
      kind: "copy",
      params: { copyType: "发布文案" },
    },
    { key: "generate_video", label: "视频生成", type: "generate", kind: "video" },
    {
      key: "generate_video_copy",
      label: "发布文案",
      type: "generate",
      kind: "copy",
      params: { copyType: "发布文案" },
    },
    { key: "wait_confirm", label: "预览确认", type: "manual" },
    { key: "create_listing", label: "店铺上架", type: "listing" },
    { key: "create_publish", label: "单账号发布", type: "publish", multiAccount: false },
    { key: "data_done", label: "数据回流", type: "observe", hint: "记录发布结果。" },
  ],
  淘宝: [
    { key: "product_info", label: "商品资料", type: "manual" },
    {
      key: "generate_image",
      label: "主图与详情图",
      type: "generate",
      kind: "image",
      params: { imageType: "详情页图", imageCount: 4 },
    },
    {
      key: "generate_copy",
      label: "标题与详情文案",
      type: "generate",
      kind: "copy",
      params: { copyType: "商品标题" },
    },
    { key: "wait_confirm", label: "预览确认", type: "manual" },
    { key: "create_listing", label: "店铺上架", type: "listing" },
    { key: "data_done", label: "数据回流", type: "observe", hint: "上架完成,记录结果。" },
  ],
};

function listTemplates() {
  return Object.entries(PLATFORM_CHAINS).map(([platform, nodes]) => ({
    platform,
    template: `${platform}链路`,
    stepCount: nodes.length,
    steps: nodes.map((n) => n.label),
  }));
}

// 把链定义转成待入库的节点行(seq + meta;状态由 machine.initializeNodes 设置)。
function buildNodeRows(platform) {
  const chain = PLATFORM_CHAINS[platform];
  if (!chain) return null;
  return chain.map((item, i) => ({
    nodeKey: item.key,
    seq: i,
    label: item.label,
    type: item.type,
    kind: item.kind || null,
    status: "未开始",
    meta: JSON.stringify({
      ...(item.params ? { params: item.params } : {}),
      ...(item.hint ? { hint: item.hint } : {}),
      ...(item.multiAccount ? { multiAccount: true } : {}),
    }),
  }));
}

module.exports = { PLATFORM_CHAINS, listTemplates, buildNodeRows };
