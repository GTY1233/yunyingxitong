# AI 电商自动运营系统

围绕电商商品运营的 AI 自动化系统。

```text
待办收件箱（发现待办）
→ 商品运营台（生成 · 预览 · 发布，一页完成）
→ 发布中心（上架草稿 · 发布任务 · 导出）
→ 库存联动 → 数据回流
```

## 推荐使用路径

1. **待办** — 处理待发布、失败重试、缺素材、库存预警
2. **商品运营台** — 日常主战场：补全素材、预览、发布
3. **发布中心** — 全局查看上架/发布任务
4. **更多** — 生成任务监控、跨商品成品库、账号、库存

刷新页面请 **Ctrl+F5**（当前前端 `app.js?v=1.5.0`）。

## 运行

```bash
npm start
```

访问 http://localhost:4173

本地数据保存在 `data/db.json`（不提交到仓库）。

### 文案生成（M3）

项目根目录创建 `.env`（已在 `.gitignore` 中，不会提交），参考 `.env.example`：

```bash
COPY_API_KEY=你的密钥
COPY_API_URL=https://api.deepseek.com/chat/completions
COPY_API_MODEL=deepseek-chat
```

然后 `npm start`。也支持其他 OpenAI 兼容接口，改 `COPY_API_URL` 和 `COPY_API_MODEL` 即可。

### 图片生成（M4）

在 `.env` 中配置 RunningHub：

```bash
RUNNINGHUB_API_KEY=你的密钥
RUNNINGHUB_BASE_URL=https://www.runninghub.ai
```

未配置时使用本地 SVG 模板预览，不影响演示。

### 视频生成（M5）

与图片共用 `RUNNINGHUB_API_KEY`。未配置时使用模板封面 + 自动脚本预览。

可选配置视频接口：

```bash
RUNNINGHUB_VIDEO_ENDPOINT=/openapi/v2/kling-v2.5-turbo-std/text-to-video
```

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
