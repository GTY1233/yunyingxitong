# M1 API 契约

## 1. 目标

M1 的目标是把静态 MVP 升级为真实数据基座。

本阶段先使用本地 Node 服务和 JSON 文件持久化，接口设计保持接近后续真实后端，方便未来替换为数据库和任务队列。

## 2. 数据接口

### 健康检查

```http
GET /api/health
```

返回服务状态。

### 获取完整状态

```http
GET /api/state
```

返回当前全部业务数据：

- products
- workflows
- assets
- reviews
- listingTasks
- publishTasks
- accounts
- logs

### 保存完整状态

```http
POST /api/state
```

用于前端首次把静态种子数据写入本地 JSON 数据库。

## 3. 资源接口

资源列表：

- products
- workflows
- assets
- reviews
- listingTasks
- publishTasks
- accounts
- logs

### 查询资源列表

```http
GET /api/resources/:resource
```

示例：

```http
GET /api/resources/products
```

### 新增资源

```http
POST /api/resources/:resource
```

请求体为资源对象。服务端会在没有 id 时自动生成 id。

### 修改资源

```http
PATCH /api/resources/:resource/:id
```

请求体为要合并的字段。

## 4. 业务动作接口

业务动作接口负责处理会影响多个对象的操作。

### 模拟生成素材

```http
POST /api/actions/generate
```

请求体：

```json
{
  "productId": "P1001",
  "kind": "image"
}
```

kind 支持：

- image
- copy
- video

动作结果：

- 新增素材
- 新增审核任务
- 更新商品状态
- 写入操作日志

### 提交审核

```http
POST /api/actions/reviews
```

请求体：

```json
{
  "productId": "P1001",
  "target": "智能恒温杯 手动提交项",
  "type": "素材"
}
```

### 处理审核

```http
POST /api/actions/reviews/:id/decision
```

请求体：

```json
{
  "decision": "审核通过"
}
```

decision 支持：

- 审核通过
- 修改后通过
- 审核驳回
- 要求重新生成

### 创建发布任务

```http
POST /api/actions/publish-tasks
```

请求体：

```json
{
  "productId": "P1001"
}
```

动作结果：

- 库存为 0 时任务状态为已暂停
- 库存充足时任务状态为待发布

### 创建上架草稿

```http
POST /api/actions/listing-tasks
```

请求体：

```json
{
  "productId": "P1001"
}
```

动作结果：

- 库存为 0 时上架状态为库存拦截
- 否则创建草稿中任务

### 同步库存

```http
POST /api/actions/inventory/sync
```

请求体：

```json
{
  "productId": "P1003",
  "stock": 45
}
```

动作结果：

- 更新商品库存
- 恢复该商品待发布任务
- 写入库存日志

