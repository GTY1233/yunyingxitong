# 核心数据模型

## 1. 设计目标

- 商品是主实体
- 成品（Asset）围绕商品沉淀
- 所有长耗时动作都用任务表示
- 所有关键动作都记录日志
- 生成结果必须版本化
- **无独立审核任务（ReviewTask）**

## 2. Product 商品

关键字段：id, name, code, category, price, status, targetPlatforms, boundAccounts, sellingPoints, specs, imageStatus, copyStatus, videoStatus, listingStatus, publishStatus

子状态（图片/文案/视频）：未生成 → 生成中 → 已生成 → 已发布

商品状态：待完善 → 待生成 → 生成中 → 待发布 → 已发布

## 3. Asset 成品

关键字段：id, productId, type, name, content, version, source, kind, status, usage, createdAt

成品状态：

- 已生成（可预览、可发布）
- 已发布
- 生成失败

成品类型 kind：image | copy | video

来源 source：generated | manual

## 4. GenerationTask 生成任务

M2 引入，用于异步 AI 生成（图片 / 文案 / 视频统一抽象）。

关键字段：id, productId, productName, kind, type, label, status, assetId, assetName, error, attempts, maxAttempts, createdAt, updatedAt, startedAt, finishedAt

状态：待执行 → 执行中 → 已成功 | 失败

失败任务可重试，默认最多 3 次。

## 5. ListingTask 上架任务

状态：未上架 → 草稿中 → 上架中 → 已上架 | 上架失败

## 6. PublishTask 发布任务

关键字段：id, productId, assetId, assetName, platform, account, status, scheduledAt, attachProduct

状态：待发布 → 发布中 → 已发布 | 发布失败 | 已暂停

## 7. PlatformAccount 平台账号

店铺账号 + 内容账号，含人设和发布规则。

## 8. Inventory 库存

简易版，联动上架和发布。

## 9. WorkflowInstance 自动化流程实例

M8+ 引入流程编排（商品维度：生成→确认→发布）。

M14 将引入 **PlatformWorkflow**（平台维度：录入→生图→生视频→上架→矩阵发布），见 [09-core-platform-workflow-design.md](./09-core-platform-workflow-design.md) §9、§12。

## 10. OperationLog 操作日志

动作类型：generation, asset, publish, general

## 11. 与界面的对应关系（收敛后）

| 数据实体 | 主要展示位置 |
|----------|--------------|
| Product | 工作台、商品运营台、发布任务 |
| Asset | 运营台中栏预览 |
| GenerationTask | 运营台左栏（本商品任务） |
| ListingTask / PublishTask | 运营台右栏 + 发布任务 |
| PlatformAccount / Inventory | 必要配置导航 |
| WorkflowInstance / 策略 / 分析 | **仅后端**，M14 工作流页接入 |
| OperationLog | 运营台折叠区 |
