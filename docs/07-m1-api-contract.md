# M1 API 契约

## 1. 目标

M1 的目标是把静态 MVP 升级为真实数据基座。

本阶段使用本地 Node 服务和 JSON 文件持久化。

## 2. 数据接口

### 健康检查

```http
GET /api/health
```

响应示例：

```json
{
  "ok": true,
  "service": "yunyingxitong-mvp",
  "copyProvider": "deepseek",
  "imageProvider": "template",
  "videoProvider": "template"
}
```

`copyProvider` / `imageProvider` / `videoProvider` 取值：`template` | `deepseek` | `api` | `runninghub`

### 获取完整状态

```http
GET /api/state
```

返回：products, workflows, assets, generationTasks, listingTasks, publishTasks, accounts, logs

### 保存完整状态

```http
POST /api/state
```

## 3. 资源接口

资源列表：products, workflows, assets, generationTasks, listingTasks, publishTasks, accounts, logs

- `GET /api/resources/:resource`
- `POST /api/resources/:resource`
- `PATCH /api/resources/:resource/:id`

## 4. 业务动作接口

### 创建生成任务（异步）

```http
POST /api/actions/generate
```

```json
{
  "productId": "P1001",
  "kind": "copy",
  "copyType": "发布文案",
  "platform": "抖音",
  "versionCount": 3,
  "extraPrompt": "强调使用场景，不要夸大宣传"
}
```

kind: image | copy | video

文案专用参数（kind=copy 时）：

- copyType: 商品标题 | 核心卖点 | 详情文案 | 视频脚本 | 发布文案
- platform: 目标平台
- versionCount: 1-5
- extraPrompt: 额外要求

图片专用参数（kind=image 时）：

- imageType: 商品主图 | 详情页图 | 卖点图 | 封面图
- imageSize: 1:1 平台主图 | 3:4 小红书 | 9:16 竖版
- imageCount: 1-6
- extraPrompt: 风格要求

视频专用参数（kind=video 时）：

- videoType: 商品展示视频 | 图文混剪视频 | 商品讲解视频
- videoRatio: 9:16 竖版 | 1:1 方版 | 16:9 横版
- videoDuration: 15 秒 | 30 秒
- extraPrompt: 分镜脚本或额外要求（留空则自动生成）

动作结果：

- 新增 generationTask（status: 待执行 → 执行中 → 已成功 | 失败）
- 文案任务成功后 asset 含 content + variants（多版本）
- 图片任务成功后 asset 含 imageUrl、isPrimary
- 视频任务成功后 asset 含 content（脚本）、posterUrl、videoUrl（RunningHub 时）
- 商品对应类型状态变为「生成中」→「已生成」
- 写入生成日志

### 编辑文案成品

```http
PATCH /api/actions/assets/:id
```

```json
{ "content": "修改后的文案内容" }
```

或切换版本：

```json
{ "selectedVariant": 1 }
```

### 重试失败任务

```http
POST /api/actions/generation-tasks/:id/retry
```

动作结果：

- 失败任务重新排队（最多 3 次）
- 商品对应类型状态回到「生成中」

### 登记成品

```http
POST /api/actions/assets
```

```json
{
  "productId": "P1001",
  "name": "恒温杯主图 B",
  "kind": "image",
  "type": "主图",
  "content": ""
}
```

### 从成品创建发布任务

```http
POST /api/actions/publish-from-asset
```

```json
{ "assetId": "A002" }
```

动作结果：

- 创建 publishTask（关联 assetId）
- asset.status → 已发布
- 更新商品 publishStatus
- 写入发布日志

### 创建发布任务

```http
POST /api/actions/publish-tasks
```

```json
{ "productId": "P1001", "assetId": "A002" }
```

### 创建上架草稿

```http
POST /api/actions/listing-tasks
```

```json
{ "productId": "P1001" }
```

### 创建 / 更新商品

```http
POST /api/actions/products
PATCH /api/actions/products/:id
```

### 同步库存

```http
POST /api/actions/inventory/sync
```

```json
{ "productId": "P1003", "stock": 45 }
```

## 5. 前端页面对接说明

以下说明 API 在 **UX 重构后** 的主要调用位置（详见 [信息架构](./04-information-architecture.md)）。

| 接口 | 主要页面 |
|------|----------|
| `POST /api/actions/generate` | 商品运营台 · 左栏（快捷生成 / 一键补全） |
| `POST /api/actions/generation-tasks/:id/retry` | 运营台左栏、待办跳转后、生成任务（更多） |
| `PATCH /api/actions/assets/:id` | 运营台 · 中栏预览（编辑文案、切换版本） |
| `POST /api/actions/assets/:id/set-primary` | 运营台 · 中栏（设主图） |
| `POST /api/actions/publish-from-asset` | 运营台 · 中栏「确认发布」 |
| `POST /api/actions/publish-tasks` | 运营台右栏、发布中心 |
| `POST /api/actions/listing-tasks` | 运营台右栏、发布中心 |
| `POST /api/actions/products` | 顶栏新建商品、运营台折叠区 |
| `PATCH /api/actions/products/:id` | 运营台折叠区编辑资料 |
| `POST /api/actions/inventory/sync` | 库存（更多） |
| `GET /api/actions/export-pack?productId=` | 运营台右栏导出 JSON 素材包 |
| `POST /api/actions/workflows` | 运营台启动半自动流程 |
| `POST /api/actions/workflows/:id/confirm` | 运营台「已预览，继续流程」 |
| `POST /api/actions/workflows/:id/retry` | 重试失败节点 |
| `POST /api/actions/workflows/:id/skip` | 跳过当前节点 |
| `GET /api/state` | 全站；待办与运营台轮询刷新 |

待办收件箱 **不单独提供 API**，由前端根据 `products` / `assets` / `generationTasks` / `workflowInstances` 聚合生成。
