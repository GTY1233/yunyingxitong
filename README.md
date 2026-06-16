# AI 电商自动运营系统

围绕**半自动工作流**的电商运营系统：录入商品 → 生成素材 → 预览确认 → 上架发布。

```text
今日工作台 → 商品运营台 → 发布任务
              ↑ 生成/预览/上架    ↑ 全局跟进
必要配置：平台账号、库存
```

完整产品与三平台分叉设计见 [docs/09-core-platform-workflow-design.md](docs/09-core-platform-workflow-design.md)。

## 推荐使用路径

1. **今日工作台** — 处理待发布、生成失败、缺素材、库存异常
2. **商品运营台** — 单商品完成图/文/视频生成与预览发布
3. **发布任务** — 查看上架草稿与发布任务状态
4. **平台账号 / 库存** — 必要配置

非核心入口（数据中心、流程编排、策略优化等）已从界面移除，后端 API 保留供下一阶段工作流页接入。

刷新页面请 **Ctrl+F5**（当前 `app.js?v=1.6.0`）。

## 运行

```bash
npm start
```

访问 http://localhost:4173

本地数据：`data/db.json`（不提交仓库）。

### 文案生成

`.env` 参考 `.env.example`：

```bash
COPY_API_KEY=你的密钥
COPY_API_URL=https://api.deepseek.com/chat/completions
COPY_API_MODEL=deepseek-chat
```

### 图片 / 视频（RunningHub）

```bash
RUNNINGHUB_API_KEY=你的密钥
RUNNINGHUB_BASE_URL=https://www.runninghub.ai
```

未配置时使用本地模板预览。

## 文档

| 文档 | 说明 |
|------|------|
| [09 核心平台工作流](docs/09-core-platform-workflow-design.md) | 母文档：三平台链、抖音矩阵、开发拆解 |
| [04 信息架构](docs/04-information-architecture.md) | 当前导航与页面 |
| [06 路线图](docs/06-roadmap-and-milestones.md) | 里程碑与 M14 |
