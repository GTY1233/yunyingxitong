# 核心数据模型

## 1. 设计目标

数据模型必须支持 MVP，也必须支持后续自动化升级。

核心原则：

- 商品是主实体
- 素材、任务、审核、上架、发布、库存、数据都围绕商品
- 所有长耗时动作都用任务表示
- 所有关键动作都记录日志
- 生成结果必须版本化

## 2. Product 商品

商品是系统核心对象。

关键字段：

- id
- name
- code
- category
- price
- status
- targetPlatforms
- boundAccounts
- description
- sellingPoints
- specs
- skuList
- inventoryStatus
- imageStatus
- copyStatus
- videoStatus
- listingStatus
- publishStatus
- createdAt
- updatedAt

关联对象：

- assets
- generationTasks
- reviewTasks
- listingTasks
- publishTasks
- inventories
- workflowInstances
- operationLogs

## 3. Asset 素材

素材用于管理所有原始和生成内容。

关键字段：

- id
- productId
- type
- name
- url
- content
- version
- source
- platform
- accountId
- generationTaskId
- reviewStatus
- usageStatus
- publishStatus
- tags
- createdAt
- updatedAt

素材类型：

- original_image
- ai_main_image
- ai_detail_image
- ai_selling_point_image
- cover_image
- video
- voice
- subtitle
- product_title
- selling_point_copy
- detail_copy
- video_script
- publish_copy
- asset_package

## 4. GenerationTask 生成任务

所有图片、文案、视频生成都必须进入生成任务。

关键字段：

- id
- productId
- taskType
- status
- input
- outputAssetIds
- provider
- templateId
- workflowId
- retryCount
- maxRetryCount
- errorCode
- errorMessage
- startedAt
- finishedAt
- createdBy
- createdAt

任务类型：

- image_main
- image_detail
- image_selling_point
- image_cover
- copy_title
- copy_detail
- copy_script
- copy_publish
- video_product
- video_mix
- video_talking

任务状态：

- pending
- running
- succeeded
- failed
- canceled
- waiting_review

## 5. ReviewTask 审核任务

审核任务用于控制自动化质量。

关键字段：

- id
- productId
- targetType
- targetId
- status
- reviewType
- reviewerId
- decision
- comment
- beforeSnapshot
- afterSnapshot
- createdAt
- reviewedAt

审核对象：

- asset
- copy
- video
- listing_task
- publish_task
- workflow_node

审核状态：

- pending
- approved
- rejected
- approved_with_changes
- regenerate_required
- canceled

## 6. ListingTask 上架任务

上架任务用于管理商品上架过程。

关键字段：

- id
- productId
- platform
- shopAccountId
- status
- title
- category
- attributes
- mainImages
- detailImages
- skuList
- price
- inventory
- platformDraftId
- platformProductId
- errorMessage
- createdAt
- submittedAt
- finishedAt

状态：

- not_started
- draft
- pending_review
- submitting
- listed
- failed
- offline
- canceled

## 7. PublishTask 发布任务

发布任务用于管理内容分发。

关键字段：

- id
- productId
- platform
- contentAccountId
- status
- assetIds
- title
- copy
- coverAssetId
- scheduledAt
- publishedAt
- attachProduct
- listingTaskId
- platformPostId
- errorMessage
- createdAt

状态：

- pending
- scheduled
- publishing
- published
- failed
- platform_reviewing
- platform_rejected
- paused
- canceled

## 8. PlatformAccount 平台账号

平台账号包括店铺账号和内容账号。

关键字段：

- id
- platform
- accountType
- name
- externalId
- authStatus
- permissions
- persona
- publishRules
- linkedShopAccountId
- lastPublishStatus
- createdAt
- updatedAt

账号类型：

- shop
- content

授权状态：

- authorized
- expired
- unauthorized
- error

## 9. Inventory 库存

库存先做简易版，但要能联动上架和发布。

关键字段：

- id
- productId
- skuId
- platform
- shopAccountId
- currentStock
- warningStock
- lockedStock
- availableStock
- status
- updatedAt

状态：

- sufficient
- low
- insufficient
- sold_out
- sync_pending
- sync_failed

## 10. WorkflowInstance 自动化流程实例

流程实例用于承载后续自动化。

MVP 可以先做基础展示，后续接入真实执行器。

关键字段：

- id
- productId
- workflowType
- status
- currentNode
- nodes
- startedAt
- finishedAt
- createdBy
- createdAt

流程类型：

- full_new_product
- semi_auto_material
- material_only
- batch_new_product
- multi_account_publish
- inventory_linked

流程状态：

- pending
- running
- waiting_review
- paused
- succeeded
- failed
- canceled

## 11. OperationLog 操作日志

所有关键动作都记录日志。

关键字段：

- id
- productId
- actorId
- action
- targetType
- targetId
- beforeSnapshot
- afterSnapshot
- message
- createdAt

日志动作：

- product_created
- asset_uploaded
- generation_started
- generation_succeeded
- generation_failed
- review_approved
- review_rejected
- listing_created
- listing_submitted
- listing_failed
- publish_created
- publish_succeeded
- publish_failed
- inventory_updated
- workflow_started
- workflow_paused
- workflow_finished

