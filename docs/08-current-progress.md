# 当前进展总结

## 1. 项目定位

AI 电商自动运营系统，围绕商品完成：

```text
待办 → 商品运营台 → 全自动流程 → 发布中心 → 库存联动 → 平台 API → 数据回流
```

## 2. 已完成

- M1–M11：生成、流程、发布、库存、平台适配、数据中心
- **M12**：自动化运营 V1（完整链路 + 批量 + 多账号矩阵）
- **M13 V1**：策略优化（智能策略面板、差异化文案、数据中心策略总览、批量 SKU 推荐流程）
- **M13 扩展**：流程编排器 + 模板 A/B 分析

## 3. 运行方式

```bash
npm start
```

访问 http://localhost:4173 ，**Ctrl+F5** 刷新（`app.js?v=1.4.0`）。

## 4. 全自动运营（待办页）

- **新建商品**：勾选「创建后自动跑全流程」
- **批量启动**：待办页「一键全自动」，支持多账号矩阵与确认后自动上架发布
- **人工介入点**：成品预览确认、异常重试/跳过（无审核中心）

API：

- `POST /api/actions/auto-ops/start` — 批量启动全自动运营
- `POST /api/actions/products` + `autoStart: true` — 创建并自动启动
- `GET /api/auto-ops/eligible` — 可启动商品列表

## 5. 数据中心（更多 → 数据）

- 商品表现、自动化成功率、成品排行、账号效果、优化建议
- **策略总览**：高表现成品、运营机会、批量启动推荐流程
- API：`GET /api/analytics/summary`、`GET /api/strategy/summary`

## 6. 智能策略（商品运营台 + 数据中心）

- **商品运营台**：推荐成品 / 流程 / 账号匹配；一键差异化文案（融入 A/B 优胜模板）；采纳主图
- **数据中心**：批量按推荐模板启动 SKU 流程；模板 A/B 表现排行
- API：
  - `GET /api/strategy/product/:id` — 单商品策略
  - `POST /api/actions/strategy/apply` — 执行策略动作
  - `POST /api/actions/strategy/batch-apply` — 批量启动推荐流程
  - `GET /api/analytics/template-ab` — 模板 A/B 报告

## 7. 流程编排器（更多 → 自动化流程）

- 从节点库组合自定义流程（生成 / 确认 / 上架 / 发布）
- 保存后在批量启动、商品运营台模板选择中可用
- API：
  - `GET /api/workflows/node-catalog` — 可用节点
  - `POST /api/workflows/custom-templates` — 保存自定义模板
  - `DELETE /api/workflows/custom-templates/:id` — 删除模板

## 8. 下一步

- 可视化拖拽编排、跨商品策略实验
