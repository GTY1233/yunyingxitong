# AI 电商自动运营系统

这是一个围绕电商商品运营的 AI 自动化系统。

产品目标不是单点 AI 工具，而是完整的商品运营链路：

```text
上传商品
→ AI 生成图片、文案、视频
→ 审核
→ 素材沉淀
→ 上架草稿
→ 发布任务
→ 库存联动
→ 数据回流
```

当前阶段先按 MVP 推进，但最终目标是自动化运营系统。

## MVP 原型

当前已提供静态可交互 MVP，并开始进入 M1 真实数据基座。

- 入口：[index.html](./index.html)
- 样式：[styles.css](./styles.css)
- 交互与模拟数据：[app.js](./app.js)
- 本地服务：[server.js](./server.js)

直接用浏览器打开 `index.html` 即可查看。

如果需要启用本地 API 和 JSON 数据持久化：

```bash
npm start
```

然后访问：

```text
http://localhost:4173
```

本地运行时会自动创建 `data/db.json` 保存商品、素材、审核、发布、库存和日志数据。该文件只作为本地运行数据，不提交到仓库。

## 文档

- [产品原则](./docs/00-product-principles.md)
- [MVP 范围与产品路线图](./docs/01-mvp-scope-and-roadmap.md)
- [核心数据模型](./docs/02-core-data-model.md)
- [业务链路与状态机](./docs/03-workflows-and-state-machines.md)
- [信息架构与关键页面](./docs/04-information-architecture.md)
- [开发实施计划](./docs/05-implementation-plan.md)
- [产品路线图与完整里程碑](./docs/06-roadmap-and-milestones.md)
- [M1 API 契约](./docs/07-m1-api-contract.md)
- [当前进展总结](./docs/08-current-progress.md)
