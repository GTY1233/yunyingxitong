# 当前进展总结

## 1. 项目定位

AI 电商自动运营系统，**核心半自动工作流**见 [09-core-platform-workflow-design.md](./09-core-platform-workflow-design.md)。

## 2. 界面（v1.8.0）

**一级导航**：今日工作台、平台工作流、发布任务；二级：平台账号、库存。

刷新：**Ctrl+F5**（`app.js?v=1.8.0`）。

## 3. M14 接口已全部接通（演示模式默认开启）

无真实 OpenAPI 密钥/账号时，`PLATFORM_DEMO_MODE` 默认开启（设 `PLATFORM_DEMO_MODE=0` 关闭），仍走完整调用链并返回可联调结果。

| 链路 | 接口层 | 行为 |
|------|--------|------|
| 生成 | RunningHub / 模板 | 按 `generationTemplateId` 路由 endpoint；任务带 `platformWorkflowId` |
| 抖音上架 | `addV2` + `launch` 载荷 | `store-listing-service` → `douyin` adapter → 回写 `externalId` |
| 淘宝/小红书上架 | 各平台 `invokePlatformListingApi` | 同上 |
| 矩阵发布 | `dispatchPublish` | 演示账号自动注入；节点内批量 `execute-publish` |
| 授权号橱窗 / 联盟 | `observe-check` | `platform-observe-service` 检查并等待确认 |
| 导出兜底 | `GET .../listing-tasks/:id/export` | 上架包 JSON |

启动工作流时自动注入演示账号（主店 + 授权号 + 达人号），**不要求事先在后台绑号**。

## 4. 平台工作流节点操作

- **生成**：模板下拉 + 参数 → `/api/actions/generate`
- **上架**：`pw-advance` 自动建草稿并调上架 API；可导出上架包
- **观测**：`pw-observe-check` → 确认并继续
- **矩阵发布**：`pw-advance` 或 `pw-execute-publish` 调发布 API

## 5. 运行

```bash
npm start
```

http://localhost:4173

## 6. 环境变量（可选）

| 变量 | 说明 |
|------|------|
| `PLATFORM_DEMO_MODE=0` | 关闭演示，无密钥时上架/发布可能失败并走导出 |
| `DOUYIN_OPEN_API_KEY` | 抖店真实密钥（占位联调） |
| `RUNNINGHUB_API_KEY` | 真实生图/视频 |

## 7. 下一步

- 对接真实抖店 OpenAPI 实测参数
- 原图批量上传字段（启动页左栏）
- 数据回流接统计 API
