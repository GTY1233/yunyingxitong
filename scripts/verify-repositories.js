// 验证仓储层对真实 app.db 工作正常（运行：node scripts/verify-repositories.js）。
const repos = require("../lib/repositories");

(async () => {
  console.log("=== products.list ===");
  const ps = await repos.products.list();
  console.log(`商品数: ${ps.length}（期望 6）`);

  const p1027 = await repos.products.getByDisplayCode("P1027");
  console.log(`\n=== getByDisplayCode("P1027") ===`);
  console.log(`${p1027.name} ¥${(p1027.priceCents / 100).toFixed(2)} 库存${p1027.stock}`);

  const full = await repos.products.getWithRelations(p1027.id);
  console.log(
    `关联资产 ${full.assets.length} 个、平台映射 ${full.productMappings.length} 个、工作流 ${full.workflows.length} 条`
  );

  console.log("\n=== 派生状态(替代旧 imageStatus 等字段)===");
  const st = await repos.status.deriveProductMediaStatus(p1027.id);
  console.log(JSON.stringify(st));

  console.log("\n=== accounts.byRole ===");
  const authorized = await repos.accounts.byRole("authorized");
  const creators = await repos.accounts.byRole("creator");
  console.log(`授权号 ${authorized.length} 个: ${authorized.map((a) => a.name).join(", ")}`);
  console.log(`达人号 ${creators.length} 个: ${creators.map((a) => a.name).join(", ")}`);

  console.log("\n=== assets.listByProduct(P1027, image) ===");
  const imgs = await repos.assets.listByProduct(p1027.id, "image");
  console.log(`图片资产 ${imgs.length} 个，首个 media_url: ${imgs[0]?.mediaUrl}`);

  await repos.client.disconnect();
  console.log("\n✓ 仓储层验证通过");
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
