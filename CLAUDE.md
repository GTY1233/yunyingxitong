# CLAUDE.md — 工程上手指南

> 给协作者 / AI 助手的项目导航。产品设计文档在 `docs/`,重构方案在 `docs/11-architecture-refactor-and-best-practices.md`(**动任何结构前先读它**)。

## 这是什么

AI 电商自动运营系统(MVP)。半自动工作流:**录入商品原图+基础信息 → AI 生图/生文/生视频 → 预览确认 → 主店上架 → 抖音矩阵/小红书/淘宝发布 → 数据回流**。
抖音矩阵核心机制:**商品只在主店创建上架一次**,授权号靠平台自动同步橱窗、达人号靠精选联盟挂载(系统只「观测」,不重复上架)。

## 技术现状(重构起点)

- **前端**:原生 JS,无框架。`index.html` + `app.js`(~4470 行,全局 `state` + `innerHTML` 渲染)+ `styles.css`。
- **后端**:Node 原生 `http`,无框架。`server.js`(`handleApi` 巨函数,`if (method && pathname)` 顺序匹配路由)。
- **业务逻辑**:`lib/` 下 27 个 CommonJS service 模块(**核心资产,重构时保留迁移**)。
- **数据**:`data/db.json` 单文件 JSON,经 `lib/db-service.js` 读改写(不入库)。

> ⚠️ 已知 P0 隐患(重构中修复):API 无鉴权(`POST /api/state` 可覆盖整库)、`infoBox` 不转义(XSS)、单文件并发丢更新、状态多真相源已分叉。详见 `docs/11`。

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm start` | 启动服务 → http://localhost:4173 |
| `npm test` | 运行 Vitest 单元测试(`tests/`) |
| `npm run fix` | Biome 一键 lint + 格式化(`biome check --write`) |
| `npm run lint` | 仅 lint |
| `npm run typecheck` | `tsc --noEmit`(TS checkJs 渐进引入,仅检查带 `// @ts-check` 的文件) |
| `npm run check` | 自写的 JS 语法体检(`scripts/check-js.js`) |
| `pm2 start ecosystem.config.cjs` | 用 PM2 托管(自动重启/开机自启) |

健康检查:`GET /api/health`(探测 db 可读性,不可读返回 503)。

## 关键目录 / 文件

- `lib/platform-workflow-engine.js` — **核心**:三平台节点链 `PLATFORM_CHAINS` + 节点状态机。
- `lib/publish-service.js` `validatePublishPreconditions` — 发布前置校验(库存/授权/限流)。
- `lib/runninghub-client.js` — RunningHub 生图/生视频真实集成(唯一真打通的外部 API)。
- `lib/store-listing-service.js` — 主店上架 payload 构造。
- `lib/account-utils.js` — 主店/授权号/达人号矩阵角色解析。
- `lib/db-service.js` — JSON 持久化(阶段 1 将被 SQLite 替换)。
- `tests/` — Vitest 单测,**优先覆盖纯业务规则**(发布校验、上架完整度、状态迁移)。

## 约定

- 状态值用中文枚举字符串(如 `已生成 / 生成中 / 失败 / 待发布`),散落多处——改动时全局核对,渐进用 `// @ts-check` + JSDoc 锁形状。
- 渲染用户/AI 内容务必转义(`escapeHtml`),严禁裸 `innerHTML` 拼接外部数据。
- 提交:小步、按主题拆;Conventional Commits;CI(`.github/workflows/ci.yml`)跑 biome + typecheck + test。

## 重构状态(2026-06)

绞杀者模式分 5 阶段:**阶段0 工程地基(进行中)→ 阶段1 SQLite 数据层 → 阶段2 Fastify 后端 → 阶段3 XState 工作流引擎 → 阶段4 Vue3 前端**。
目标栈与不做清单见 `docs/11`。前端确定走 **Vue 3 + Element Plus**(产品后续将售卖)。
