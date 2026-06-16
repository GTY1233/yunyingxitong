/** 无真实平台密钥/账号时仍走完整接口链，返回可联调的演示结果 */
function isPlatformDemoMode() {
  return process.env.PLATFORM_DEMO_MODE !== "0";
}

const DEMO_ACCOUNTS_BY_PLATFORM = {
  抖音: [
    { name: "抖店主账号", type: "店铺账号", role: "main_shop", persona: "商品管理", rule: "上架前必须审核" },
    { name: "抖音授权号 A", type: "内容账号", role: "authorized", persona: "种草展示", rule: "每天最多 3 条" },
    { name: "抖音授权号 B", type: "内容账号", role: "authorized", persona: "场景测评", rule: "每天最多 3 条" },
    { name: "抖音授权号 C", type: "内容账号", role: "authorized", persona: "促销转化", rule: "每天最多 3 条" },
    { name: "抖音达人号 D", type: "内容账号", role: "creator", persona: "达人带货", rule: "每天最多 2 条" },
  ],
  小红书: [
    { name: "小红书店铺", type: "店铺账号", role: "main_shop", persona: "店铺运营", rule: "上架前必须审核" },
    { name: "小红书视频号", type: "内容账号", role: "creator", persona: "生活方式种草", rule: "每天最多 2 条" },
  ],
  淘宝: [{ name: "淘宝店铺", type: "店铺账号", role: "main_shop", persona: "商品管理", rule: "上架前必须审核" }],
};

function ensurePlatformDemoAccounts(db, product, platform, helpers) {
  if (!isPlatformDemoMode()) return;
  const defs = DEMO_ACCOUNTS_BY_PLATFORM[platform] || [];
  db.accounts = db.accounts || [];
  const names = new Set(product.accounts || []);
  defs.forEach((def) => {
    let account = db.accounts.find((item) => item.name === def.name && item.platform === platform);
    if (!account) {
      account = {
        id: helpers.nextId(db.accounts, "AC"),
        platform,
        name: def.name,
        type: def.type,
        auth: "已授权",
        rule: def.rule,
        persona: def.persona,
        role: def.role,
        demo: true,
      };
      db.accounts.unshift(account);
    }
    names.add(def.name);
  });
  product.accounts = [...names];
}

function demoShopAccount(platform) {
  const defs = DEMO_ACCOUNTS_BY_PLATFORM[platform] || [];
  const shop = defs.find((item) => item.type === "店铺账号") || defs[0];
  return shop
    ? {
        id: `demo-shop-${platform}`,
        platform,
        name: shop.name,
        type: shop.type,
        auth: "已授权",
        rule: shop.rule,
        persona: shop.persona,
        role: shop.role,
        demo: true,
      }
    : null;
}

function demoContentAccounts(platform) {
  return (DEMO_ACCOUNTS_BY_PLATFORM[platform] || [])
    .filter((item) => item.type === "内容账号")
    .map((item, index) => ({
      id: `demo-content-${platform}-${index}`,
      platform,
      name: item.name,
      type: item.type,
      auth: "已授权",
      rule: item.rule,
      persona: item.persona,
      role: item.role,
      demo: true,
    }));
}

function ensureDemoContext(ctx) {
  if (!ctx.account && ctx.task) {
    ctx.account = {
      id: `demo-${ctx.platform}`,
      platform: ctx.platform,
      name: ctx.task.account || `${ctx.platform}演示账号`,
      type: "内容账号",
      auth: "已授权",
      demo: true,
    };
  }
  if (!ctx.account) {
    ctx.account = demoShopAccount(ctx.platform) || demoContentAccounts(ctx.platform)[0];
  }
  return ctx;
}

function demoExternalId(platform, prefix = "EXT") {
  const slug = String(platform || "PL").slice(0, 2);
  return `${slug}-${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

module.exports = {
  isPlatformDemoMode,
  DEMO_ACCOUNTS_BY_PLATFORM,
  ensurePlatformDemoAccounts,
  demoShopAccount,
  demoContentAccounts,
  ensureDemoContext,
  demoExternalId,
};
