# 抖音单链路(上架+发布)技术调研与无凭证搭建落地方案

> 范围:抖音单平台的「主店上架 → 授权号橱窗观测 → 精选联盟观测 → 矩阵视频发布挂车」整条链路。目标:在**没有任何开发者 key** 的当下把架构、配置层、适配器、工作流接线全部建好,办下 key 后只补「真实 HTTP 调用 + 签名」两处即可切真。
> 凡标注 **`待实测`** 的,务必在拿到 key/测试店铺后照抖店官方页(op.jinritemai.com)复核——本调研多处依赖镜像站(doc.fw199.com)与第三方博客交叉印证,字段名可能与官方最新版有出入。

---

## 1. 一句话结论 + 全链路总览

**一句话结论:** 抖音整条链里**只有「主店上架」一段有可用且门槛最低的官方 API**(抖店自用型应用 + `product/addV2`),其余三段——授权号橱窗、精选联盟、视频挂车——**对个体工商户基本拿不到可编程的写接口**:橱窗/联盟是平台后台原生自动同步(系统只观测),视频挂车的开放 API 对个体不开放(只能 RPA 或导出人工)。因此架构上把这四段统一抽象成同签名的 `PlatformAdapter`,用 **demo / real / manual** 三态驱动,现在全部以 demo+manual 跑通,办下 key 后逐段切 real。

**全链路总览表**(节点 key 对应现有 `lib/platform-workflow-engine.js` 的 `PLATFORM_CHAINS.抖音`):

| 工作流节点 | 链路语义 | 落地方式 | 是否需 key | 前置依赖 |
|---|---|---|---|---|
| `create_listing` | 主店创建+上架商品 | **官方 API**(抖店 `product/addV2`,自用型应用);未就绪时 **manual 导出任务包** | 需(抖店 app_key/secret + 店铺授权) | 完整度达标、叶子类目 ID、图片已传素材中心 |
| `observe_authorized` | 授权号橱窗已同步 | **平台原生**(后台自动同步,系统只观测);很可能**无查询 API → 恒人工确认** | 不需要 | 授权号已在抖店后台绑定(蓝V/同营业执照/≥1000粉/体验分≥4.0) |
| `observe_alliance` | 精选联盟已挂载 | **平台原生**(后台一键推广+新品自动加入);商家侧**无写 API → 人工确认** | 不需要 | 已开通精选联盟、佣金率已在后台设 |
| `create_publish` | 矩阵号发视频+挂车 | **RPA 为主**(Playwright 模拟创作者中心);兜底 **manual 导出任务包**;官方 API **不可得** | 视频发布权限个体户难批,长期停 manual/RPA | 商品已上架(拿到 externalProductId)、视频素材就绪、各号登录态 |

> 关键纠正(对 docs/09):①token 主机是抖店 `openapi-fxg.jinritemai.com`,**不是** `developer.toutiao.com`(那是小程序);②自用型走 `grant_type=authorization_self`,**无需扫码 code**;③`/video/create` + `/item/link`「视频挂载商品」**开放 API 不支持商品挂载**,删除该路径改 RPA;④精选联盟普通商品佣金 **1%~50%**,不是 90%。

---

## 2. 抖店上架技术细节(唯一真打通的官方 API 段)

### 2.1 鉴权流程(自用型应用,本项目推荐路径)

抖音生态是**两套独立 OpenAPI**,上架走抖店侧,务必分清:

| 维度 | 抖店 `op.jinritemai.com`(上架走这套) | 抖音开放 `open.douyin.com`(视频走这套) |
|---|---|---|
| 用途 | `product/addV2` 主店上架、商品/订单/库存 | `video/create_video` 视频发布 |
| 凭证 | `app_key` / `app_secret` / `shop_id` | `client_key` / `client_secret` |
| token 接口 | `POST /token/create`(自用型 `grant_type=authorization_self`) | `POST /oauth/access_token/` |
| token 主机 | `openapi-fxg.jinritemai.com` | `open.douyin.com` |
| access_token 有效期 | **~7 天** `待实测` | **~15 天(1296000s)** `待实测` |
| refresh_token 有效期 | **~14 天** `待实测` | ~30 天 `待实测` |
| 逐请求签名 | **要**(MD5/HMAC sign) | 不需要(标准 OAuth) |
| 个体户门槛 | 商品管理权限可申请 | 视频发布权限难批 |

自用型鉴权时序(一次性 + 运行时):

```
[一次性] 注册开发者 → 创建「自用型」应用 → 拿 app_key/app_secret
        → 安全管理配 IP 白名单(服务器出口 IP,docs/09 漏写)
        → 申请「商品管理」权限包 → 等审核
        → 主店账号在应用详情页点「授权」绑定本店 → 拿 shop_id
[运行时] /token/create:grant_type=authorization_self, code="", shop_id=<主店>, app_key, sign, timestamp
        → { access_token(7天), refresh_token(14天), shop_id } → 存库(PlatformCredential 表,密文)
[续期]  access_token 快过期(提前 1 天)→ /token/refresh(grant_type=refresh_token)→ 滚动换新
        ⚠️ refresh_token 14 天不刷就失效 → 失效后须重新授权
[调用]  所有 /product/* 带 access_token + 按签名算法算 sign
```

### 2.2 签名算法(每次调用都算,纯函数,现在就能写+单测)

```
待签名串 = APP_SECRET
         + "app_key"    + APP_KEY
         + "method"     + method 名(如 product.addV2)
         + "param_json" + paramJson         // 业务参数 JSON,key 按字典序升序,值转字符串,无多余空格
         + "timestamp"  + timestamp          // 'Y-m-d H:i:s'
         + "v2"
         + APP_SECRET
sign = MD5(待签名串)                          // 也支持 hmac-sha256;算法细节 `待实测`
公共参数:app_key, access_token, method, param_json, timestamp, v=2, sign
```

> 可用现成 SDK 省去手写:`github.com/cnJun/sdk4-jinritemai`(Node)。签名算法是**上线前必须实测的头号疑点**。

### 2.3 接口清单

主机统一 `https://openapi-fxg.jinritemai.com`;method 名即路径(`product.addV2` ↔ `/product/addV2`)。价格单位统一**分**。

| # | method / 路径 | 用途 | 关键入参 | 前置 |
|---|---|---|---|---|
| 1 | `/token/create` | 换 access_token | grant_type=`authorization_self`, code="", shop_id | 应用已授权本店 |
| 2 | `/token/refresh` | 刷新 token | grant_type=refresh_token, refresh_token | 1 |
| 3 | `/shop/getShopCategory` / `/product/getCategory` | 取**叶子类目** ID | parent_id(从 0 下钻,`is_leaf=true`) | token |
| 4 | `/product/getCatePropertyV2` | 取类目**属性列表** | category_leaf_id | 3 |
| 5 | 资质规则接口(`qualificationRule`) | 取该类目**必填资质** | category_leaf_id | 3 |
| 6 | `/product/getProductUpdateRule` | 查发布规则(哪些字段必填) | category_leaf_id | 3 |
| 7 | 图片上传(素材中心,`/material/uploadImageSync` 类,路径 `待实测`) | 本地图 → 抖店 url | image 二进制 / url | token |
| 8 | **`/product/addV2`** | **创建+提审+上架商品** | 见 2.4 | 3–7 |
| 9 | `/product/editV2` | 编辑商品 | product_id + 同 addV2 | 8 |
| 10 | 上架/下架(`/product/launch` 等) | 让商品在售 | product_id | 8 |
| 11 | `/freightTemplate/list` | 取 freight_id | token | — |

> **`addV2` 是一步还是两步?** 现有代码 `store-listing-service.js:37` 假设 `["product.addV2", "product.launch"]` 两步。实测资料显示 addV2 自带 `commit`(true=提审)与 `start_sale_type`(0=审过即上架 / 1=入仓),**很可能一次到位**。建议先按「addV2 一步」实现,留 `launch` 兜底开关。**`待实测`(最高优先级)**。

### 2.4 `addV2` 入参要点

**必填:** `name`(≤30 汉字,无 emoji)、`category_leaf_id`、`product_type`(0 普通)、`pic`(主图 url,逗号分隔)、`description`、`mobile`、`reduce_type`(1 拍下减库存)、`freight_id`(0=包邮)、`commit`、`product_format_new`(把接口 4 返回 `required=1` 的类目属性填进去)。

**SKU/价格库存(组合必填):** `spec_prices_v2`(SKU 列表)或商品级 `price`+`stock`;`reference_price`(划线价);单位**分**。SKU 结构镜像里叫 `spec_prices_v2`,官方是否为 `sku`+`spec`+`spec_pics` 三段式 `待实测`(最易踩坑点之一)。

SKU 示例:
```json
[{
  "sell_properties": [
    {"property_name":"颜色分类","value_name":"白色"},
    {"property_name":"尺码大小","value_name":"M"}
  ],
  "stock_num": 50, "price": 9900, "code": "sku001"
}]
```

**幂等关键选填:** `out_product_id`/`outer_product_id`(外部商品编码,填本项目稳定 productId)。其余常用:`short_product_name`、`standard_brand_id`(无品牌默认 ID `待实测`)、`weight`、`presell_type`、`after_sale_service`、`material_video_id`(主图视频)、`size_info_template_id`。

### 2.5 图片必须先传素材中心

不能直接塞外网 url。流程:RunningHub 生成图(已落本地)→ 先调图片上传接口拿**抖店域名 url** → 再拼进 `pic`/`description`/`spec_pic`。白底主图、尺寸/大小有要求 `待实测`。

### 2.6 类目与资质

- **类目**:必须下钻到叶子(接口 3,`is_leaf=true`),录入时让用户选/AI 预测,落库 `category_leaf_id`。
- **属性**:接口 4 返回 `required=1` 的必填进 `product_format_new`;区分销售属性(组 SKU)与普通属性。
- **资质/报白**:生鲜/品牌/特殊品需后台人工报白(传营业执照、品牌授权),**不在 API 内**;普通服饰百货个体户一般无需。

### 2.7 申请与资质清单(校正 docs/09 §21)

| 维度 | 结论 |
|---|---|
| 应用类型 | 选**「自用型」**(给自己店用),别选工具型/服务商 |
| 材料 | 营业执照(个体可)、应用信息。**软著**是否强制 `待实测`(基础商品权限通常门槛较低) |
| 权限点 | **必需**:商品管理(addV2/类目/属性);按需:订单/库存/售后(数据回流) |
| 审核周期 | docs/09 写 7–14 工作日,以官方为准 `待实测` |
| IP 白名单 | **必须**在安全管理配服务器出口 IP,否则调用被拒 |
| 测试店铺 | 可绑**测试店铺**联调(商品名强制前缀「测试商品勿拍不发货」、SKU 价 ≤0.1 元、≤2000 次调用、仅部分类目);鉴权/签名/类目/属性/addV2 整链可在测试店跑通,切 shop_id 即切生产 |

### 2.8 限流、错误码、幂等

- **限流**:测试版 ≤2000 次/应用;生产 QPS `待实测`。addV2 执行器做**串行+重试退避**,失败入异常队列。
- **错误码**:`code=0` 成功,非 0 看 `message`;建映射表把「类目/属性/资质/限流」类错误转可读提示。
- **幂等(防重复上架,关键)**:平台不按标题去重,自己保证 ——
  1. `out_product_id` = 本项目稳定 productId;
  2. addV2 成功立刻回写 `externalId` 到 `PlatformProductMapping`(已有 `@@unique([productId, platform])`,天然防重);
  3. 执行器入口先查映射,有就 editV2/跳过,无才 addV2;
  4. 上架节点加状态前置(`待发布`→`上架中`→`已上架`)防并发双建。

---

## 3. 矩阵发布全链(授权号橱窗 / 精选联盟 / 视频发布)

### 3.1 授权号橱窗自动同步

| 子环节 | 路径 |
|---|---|
| 绑定授权号 | **平台原生**(抖店后台 → 经营账号管理 → 店铺授权号 → 加蓝V抖音号),无 API |
| 商品同步到橱窗 | **平台原生自动**(主店上架后自动进橱窗,不逐个上架) |
| 系统观测同步状态 | ⚠️ **无官方查询接口给商家** → 只能人工确认,或 RPA 抓橱窗页比对 |

**真门槛(docs/09 漏写):** 授权号须认证**企业蓝V**且与抖店主体**同一张营业执照**;**店铺体验分≥4.0**、主店号与授权号**各自粉丝≥1000**;要带货需迁为**店铺型授权号**(后台「立即迁移」)。同步延迟民间说约 10 分钟,**官方无 SLA `待实测`**。

**系统该建:** `observe_authorized` 观测节点,状态机 `等待平台同步 → 已同步 / 超时人工确认`;**不调任何上架 API**(会重复上架);本段**不需要 key**。

### 3.2 精选联盟(达人号挂载来源)

| 子环节 | 路径 |
|---|---|
| 商品加入联盟 | **平台原生**(后台 → 精选联盟 → 计划管理 → 商品投放;「新品自动加入推广」开关) |
| 佣金 | 普通商品 **1%~50%**(纠正 docs/09「90%」);平台服务费按类目 2%~5%(新店 30 天 1%) |
| 达人挂载 | **平台原生**(达人在选品广场自选自挂,商家无需绑定、无需逐个配置) |

**是否需 API:** 商家侧**不需要、也基本无面向商家的写接口**。`buyin.jinritemai.com/developer` 的联盟/抖客 API 面向服务商/分销,敏感字段已脱敏。**系统不开发联盟 API**,后台一键规则即可。

**系统该建:** `observe_alliance` 观测节点 + 配置项记录(默认佣金率、新品自动加入);佣金率做成商品级**仅记录/导出**字段,不调接口。本段**不需要 key**。

### 3.3 视频发布 + 商品挂载(最难,必须重新定档)

**核心事实:** 官方公开 `POST open.douyin.com/api/douyin/v1/video/create_video/`:
- 必填 `access-token`(用户 OAuth)、`open_id`、`video_id`(先 `/video/upload_video/` 上传)、`text`;
- **只支持挂载小程序锚点 + POI 地理位置,且要企业资质**;**不支持小黄车/抖店商品链接**;
- 限额 **75 作品/天/用户/应用**;scope `video.create.bind`。

**结论:** docs/09 §11.2 的 `/video/create` + `/item/link`「视频挂载商品」**作为可申请的官方组合,对个体户基本不可得**。抖音电商短视频带货挂小黄车属电商达人能力,走 App / 巨量百应,**未对商家自研应用开放**。

**三档现实排序:**

| 路径 | 可行性 | 说明 |
|---|---|---|
| 官方 API 发布+挂链 | ❌ 基本不可行 | 发布接口不支持商品挂载,挂车能力不对个体开放 |
| **RPA 浏览器自动化** | ✅ **主力** | Playwright 模拟:登录创作者/抖店 → 发视频 → 选「添加商品」挂橱窗/联盟商品 |
| **导出手动** | ✅ 兜底 | 生成「视频+文案+目标商品+目标账号」任务包,人工 App 内发布挂车 |

**个体户难点:** 拿不到商品挂载类能力(企业资质硬门槛);带货前置(App 内,非 API):实名、≥10 条视频、≥1000 粉、500 元保证金才能开小黄车,**矩阵每个发布号都要满足**。

**风控/限流(落进调度器):** API 硬限 75/天/号;docs/09 §20 自定限制(3 条/号/天、间隔≥4h、差异度≥30%、IP 隔离)**保留**,作 RPA 安全节流。

### 3.4 谁授权谁(多账号授权关系)

| 能力 | 授权方 | 凭证 | 备注 |
|---|---|---|---|
| 主店上架/商品/联盟投放 | 主店店铺账号 | 店铺 `access_token`(含 shop_id) | **一次店铺授权覆盖上架+联盟+库存** |
| 授权号橱窗同步 | 授权号(蓝V)在后台被主店**绑定** | **不走 API token** | 后台绑定即自动同步,系统不持有其 token |
| 视频发布(若走 API) | 每个发布号各自 OAuth | 用户级 `access_token`+`open_id` | 实际走 RPA,系统持有的是**各号登录态/Cookie** |
| 视频挂链 | (开放 API 不支持) | — | — |

要点:抖店域与抖音域是**两套授权体系,token 不互通**,系统分别管理。

---

## 4. 无凭证可搭建架构

### 4.1 凭证配置层

**存哪:** env 放一把**加密根密钥**,DB(密文)存会变的业务凭证/token——因为产品要售卖多租户、token 7 天一换且要程序回写,env 放不下。

| 数据 | 存哪 |
|---|---|
| `PLATFORM_CRED_ENC_KEY`(32B 主密钥) | env / `.env`(绝不入库) |
| 运行模式开关 `DOUYIN_RUN_MODE` / `PLATFORM_FORCE_DEMO` | env 默认 + DB 行可覆盖 |
| `app_key`/`app_secret`/`client_key`/`client_secret` | DB,secret 字段 AES-GCM 密文 |
| `access_token`/`refresh_token`/`expires_at` | DB,密文 |
| `shop_id`/授权店铺名/授权状态 | DB 明文(列表展示) |

**加密(Node 原生 crypto,零依赖):** `lib/security/secret-box.js`,AES-256-GCM,密文格式 `v1:iv:tag:cipher`(全 base64),`v1:` 前缀预留密钥轮换,GCM 自带完整性校验。

**DB 表草案**(加进 `prisma/schema.prisma`):

```prisma
model PlatformCredential {
  id        String  @id @default(cuid())
  platform  String  // "抖音"
  api       String  // "douyin_shop"(上架) | "douyin_open"(发布)
  label     String?
  role      String? // main_shop | creator
  appKey       String? @map("app_key")
  appSecretEnc String? @map("app_secret_enc")     // 密文
  shopId       String? @map("shop_id")
  accessTokenEnc   String?   @map("access_token_enc")   // 密文
  refreshTokenEnc  String?   @map("refresh_token_enc")  // 密文
  tokenExpiresAt   DateTime? @map("token_expires_at")
  refreshExpiresAt DateTime? @map("refresh_expires_at")
  runMode   String  @default("demo")   // demo | real | manual
  status    String  @default("未授权")  // 未授权|已授权|授权过期|刷新失败
  lastError String? @map("last_error")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")
  @@unique([platform, api, shopId])
  @@map("platform_credentials")
}
```

仓储 `lib/repositories/credential.repo.js`:`getByApi(platform, api)`、`upsert(data)`、`saveTokens(id, {accessToken, refreshToken, expiresIn})`(内部 `seal`)、`getDecrypted(id)`(只在调 API 前内存解密,**绝不返前端**)。

**配置页 `/api/v2/platform-credentials`:** `GET` 脱敏列表(secret→`****已配置/未配置`,token 只回状态+过期时刻);`PUT /:api` 存 app_key/secret;`POST /:api/authorize` 返回 OAuth 授权 URL;`GET /oauth/callback` 接 code 换 token;`PATCH /:api/run-mode` 切三态。真实 token 交换留占位。

**token 自动刷新** `lib/platform/token-manager.js#getValidAccessToken(api)`:DB 即缓存(单进程无需 Redis),提前 5 分钟视为过期;过期用 refresh_token 刷新并回写;refresh 也过期则置「授权过期」抛 `NEED_REAUTH`。加进程内 `Map<api,Promise>` 单飞锁防并发重复刷新。

### 4.2 统一 PlatformAdapter 接口签名草案

```js
/**
 * @typedef {Object} AdapterResult
 * @property {boolean} ok
 * @property {"demo"|"real"|"manual"} mode
 * @property {string} [externalId]   // 平台商品/视频 id(幂等映射用)
 * @property {object} [response]      // 原始响应(存 platformResponse)
 * @property {object} [manualTask]    // manual:导出任务包(步骤+payload)
 * @property {string} [error]
 * @property {"NEED_AUTH"|"RATE_LIMIT"|"INVALID_PAYLOAD"|"PLATFORM_ERROR"} [code]
 * @property {boolean} [retryable]
 */
class PlatformAdapter {
  capabilities() {}                                  // 静态能力声明,无需凭证可调
  async uploadImage(localPathOrUrl, creds, ctx) {}   // 本地图 → 素材库 media_id
  async createListing(payload, creds, ctx) {}        // addV2(+launch)→ externalId=productId
  async launch(externalProductId, creds, ctx) {}     // 上架后置(抖店 launch 已含,预留)
  async observeWindowSync(externalProductId, creds, ctx) {} // 查橱窗是否同步(只读不写)
  async publishVideo({ videoAsset, copy, accountCred }, ctx) {} // video/create → itemId
  async attachItem(itemId, externalProductId, creds, ctx) {}    // 视频挂商品(开放 API 不支持→manual)
  async refreshToken(refreshToken) {}                // real 专用,token-manager 调
}
```

### 4.3 三态 demo / real / manual

`lib/platform/run-mode.js#resolveRunMode(api)`:
- `PLATFORM_FORCE_DEMO=1` → `demo`(全局演示);
- 否则读 `cred.runMode || env || "demo"`;
- **想 real 但无有效凭证 → 降级 `manual`(产出人工任务包),不降级 demo(假成功)** —— 关键安全设计,绝不让用户误以为上架了。

适配器内部统一骨架(以 `createListing` 为例):demo 返回 `demoExternalId` 假结果跑通全链;manual 返回 `manualTask`(payload + 操作步骤,人工去后台贴);real 取有效 token → 签名 → 调真实 API(**唯一要补真实 HTTP 的地方**)。

真实 HTTP 占位 `lib/platform/douyin/shop-client.js#callShopApi`:real 分支现在抛 `NOT_IMPLEMENTED("真实抖店上架待办好 key 后接入")`,**可选可切但明确报错,不假成功**。

### 4.4 工作流节点接线点(精确到现有文件:行)

现状已勘验确认:`lib/workflow/executors.js:256-257` 对 listing/publish/observe 节点 `return { ok:true, demo:true, summary:"演示执行(上架/发布待接平台 API)" }` 直接假成功——这是**唯一接线入口**。

在 `executeGenerateNode` 尾部按 `node.type` 分发(替换 256-257 行):
```js
if (node.type === "listing") return executeListingNode(node, product, opts);
if (node.type === "publish") return executePublishNode(node, product, opts);
if (node.type === "observe") return executeObserveNode(node, product, opts);
return { ok: true, summary: "无副作用节点" };
```

三个新 executor 要点:
- `executeListingNode`:① 完整度门槛(`listing-check` repo 版,`completeness<100` 直接失败不调平台);② 幂等查 `PlatformProductMapping`,命中即跳过;③ `buildStoreListingPayload`(复用,见 §5)→ `adapter.createListing` → 成功写 mapping + `ListingTask`;manual 模式把 `manualTask` 存 `ListingTask.platformResponse`,前端给「导出任务包」按钮。
- `executePublishNode`:multiAccount,先查商品已上架(无 mapping 直接失败);对每个授权号/达人号循环 `publishVideo`+`attachItem`,各自独立幂等键 `publish:${productId}:${accountId}:抖音`,写 `PublishTask`;重试只补未成功账号。
- `executeObserveNode`:`runObserveWithTimeout`,demo 直接 `synced:true`;real 查橱窗(若抖店无橱窗查询 API 则恒 manual 人工确认);超时(如 15 分钟)**不计失败、转人工**——停 `待确认` 让用户去后台核对后手动 confirm/skip。

**状态机不改**:observe 推荐**方案 A**——仍是 manual/confirm 语义,前端进入节点时自动轮询 `observeWindowSync`,`synced=true` 自动 confirm,超时停 `待确认`。失败/重试/后台执行全部复用现有 `machine.js` 的 `fail`/`retry` + `service.js` 的 `runNodeJob`,**7 态不动**。

**幂等** `lib/platform/idempotency.js`:复用 `PlatformProductMapping.@@unique([productId, platform])` 做上架幂等(天然防重复 addV2/扣费);发布幂等用 `(product, account)` 的 `PublishTask`。

---

## 5. 现有代码复用与改写清单(基于勘察)

### 可直接复用(无 DB 耦合或纯逻辑)

| 文件 | 函数 | 备注 |
|---|---|---|
| `lib/platform/adapter-factory.js` | `createAdapter()`、`simulatePlatformCall()` | 纯逻辑,已有 capability 分级 + demo 降级 |
| `lib/platform/registry.js` | `getPlatformAdapter()` | 查表无状态 |
| `lib/platform/capabilities.js` | `highestCapability()`、`capabilitySummary()` | 纯计算 |
| `lib/platform-demo.js` | `demoExternalId()`、`demoShopAccount()`、`demoContentAccounts()` | demo 态直接复用 |
| `lib/store-listing-service.js` | `buildStoreListingPayload()`、`invokePlatformListingApi()` | 平台 payload 逻辑无 DB 依赖(仅 `pickListingAssets` 需改) |
| `lib/account-utils.js` | `accountCanPublish()`、`accountPersonaForCopy()` | 无 DB 访问 |

### 需改写(换 Prisma 仓储 / 改异步 / 去占位)

| 文件:行 | 现状 | 改法 |
|---|---|---|
| `lib/workflow/executors.js:256-257` | listing/publish/observe 假成功 | 按 node.type 分发到三 executor(§4.4) |
| `lib/store-listing-service.js:4-16` | `pickListingAssets(db,…)` 走 `buildExportPack(db,…)` 旧 JSON | 改 `await assetRepo.listByProduct(productId, kind)` |
| `lib/store-listing-service.js:41` | `category_id: "demo_category"` 占位 | 接真实 `category_leaf_id`(类目下钻)`待实测` |
| `lib/store-listing-service.js:37` | `steps:["product.addV2","product.launch"]` 两步假设 | 改「addV2 含 commit/start_sale_type 可能一步」`待实测` |
| `lib/account-utils.js:16,90` | `resolvePublishAccount`/`dailyPublishCount` 访问旧数组 | 改异步 + Prisma 查询 |
| `lib/platform-observe-service.js:29-32` | `db.products`/`db.listingTasks` 旧数组 | 改异步 Prisma 查询 |
| `lib/platform-workflow-engine.js:218-311` | listing/publish 段同步调 `helpers.executeListingTask/executePublishTask` | 改为 `await executeListingNode/PublishNode()` 异步投递 |
| `lib/listing-check.js:5` | `computeListingCompleteness(db,…)` JSON 版 | 加 Prisma 包装 `computeForProduct(productId)`,executor 调用前做门槛 |

### 已就绪可落库的表(`prisma/schema.prisma`,已勘验)

`ListingTask`(有 `externalId`/`platformResponse`/`failureReason`/`attempts`/`maxAttempts`/`mode`/`platformMode`)、`PublishTask`(有 `assetId`/`scheduledAt`/`attachProduct`/`attempts`)、`PlatformProductMapping`(**已有 `@@unique([productId, platform])`**)——直接用作幂等与任务记录,无需改表;只新增 `PlatformCredential`。

### 接驳点汇总

| 接驳点 | 文件:行 | 怎么改 |
|---|---|---|
| 假成功改调适配器 | `executors.js:256-257` | node.type 分发 |
| 失败/重试/后台执行 | `machine.js`、`service.js` | **不改**,复用 |
| 上架 payload 构造 | `store-listing-service.js:15-81` | 复用,真实化时替 `invokePlatformListingApi:83` 占位 |
| 旧适配器工厂 `hasLiveApi()` | `adapter-factory.js`、`adapters/douyin.js` | 现仅看 env 单 key,升级为查 `credentialRepo` + 三态;新抖音适配器并存逐步绞杀旧的 |
| 幂等映射 | `schema.prisma:216-229` | 已有唯一键,直接用 |
| env | `.env.example` | 新增 `PLATFORM_CRED_ENC_KEY=`、`DOUYIN_RUN_MODE=demo`、`PLATFORM_FORCE_DEMO=` |

> **办好 key 后的核心改动面收敛到一处:** `lib/platform/adapters/douyin.js` 的 `listingHandler`/`publishHandler` 把 `simulatePlatformCall()` 换成真实 HTTP——适配器模式已就位,workflow 层与数据层不动。

---

## 6. 落地步骤(分阶段)

### 阶段 A:现在就能做(不依赖任何 key,纯本地可单测)

1. `lib/security/secret-box.js`(AES-256-GCM seal/open)+ 往返单测。
2. `PlatformCredential` 表 + migration + `credential.repo.js`(加密读写、脱敏视图)。
3. 配置页后端 `/api/v2/platform-credentials`(CRUD + 脱敏 + 切 runMode + OAuth URL/回调骨架)。
4. `run-mode.js`(三态解析,real 无凭证→降级 manual)+ `token-manager.js`(getValidAccessToken + 单飞锁,real 调占位)。
5. `PlatformAdapter` 抽象 + 抖音适配器骨架(**demo/manual 两态完全可跑**,real 抛「待接入」)。
6. 签名工具函数(MD5 + param_json 字典序,纯函数单测)。
7. `executeListingNode/PublishNode/ObserveNode`(替换 `executors.js:256`);`idempotency.js`(复用唯一键);`listing-check` repo 版门槛;observe 超时转人工 runner。
8. 改写 `store-listing-service.js` 的 `pickListingAssets`、`account-utils`、`platform-observe-service` 为 Prisma 异步。
9. 全链单测:状态机迁移、幂等去重、完整度门槛、三态解析、加解密往返、token 过期/刷新分支(mock adapter)。

→ **产出:整条抖音链路在 demo/manual 下端到端跑通**;上架走 manual 导出包,挂链走 RPA/导出。

### 阶段 B:用户办好 key 后切真(最少步骤)

1. **填凭证**:`.env` 设一次 `PLATFORM_CRED_ENC_KEY`(`openssl rand -hex 32`);配置页填 `app_key`/`app_secret`(写库即加密)。
2. **授权店铺**:配置页点「授权」→ 抖店自用型授权(`authorization_self`)→ 回调换 token 入库,状态变「已授权」。
3. **切开关**:上架那行 `runMode` 从 demo 切 real。
4. **接真实 HTTP(唯一要写真实代码处)**:实现 `shop-client.js#callShopApi`(签名 + POST + 错误码映射)和 `refreshToken`;约 1 人 1 周。先在**测试店铺**(0.1 元测试品)验证全链路,再切 shop_id 到真店。
5. **单链路即真**:跑一个商品到 `create_listing` → 真实 addV2;`observe` 节点核对橱窗/联盟(很可能恒人工确认);`create_publish` 视频发布权限个体户难批,**可长期停 manual/RPA,不阻塞上架主链路**。

token 自动刷新、幂等防重、完整度门槛、demo/manual 兜底全程无需再动。

---

## 7. 风险与上线前必须实测的疑点清单

**上架段(抖店 API):**
1. **`addV2` 是否一步完成上架**(`commit`+`start_sale_type` 语义),还是必须再调 `launch`?——最高优先级,直接影响 `store-listing-service.js:37` 的 steps。
2. **SKU/规格确切结构**:`spec_prices_v2` 还是 `sku`+`spec`+`spec_pics` 三段?字段名核对。
3. **抖店签名算法**(MD5/HMAC、待签名串拼法)——影响 `callShopApi` 能否调通。
4. **图片上传素材中心**确切 method、入参(二进制/url)、返回字段、图片尺寸/数量规则。
5. `recommend_ids`、`standard_brand_id`(无品牌默认 ID)、`product_format_new` 确切格式;真实 `category_leaf_id`(替 `demo_category` 占位)。
6. **token 有效期实际值**(7/14 还是 15/30)与生产 QPS / 完整错误码表。
7. **自用型是否强制软著**;商品管理权限审核周期;IP 白名单是否漏配会全拒。

**矩阵段(平台原生 / RPA):**
8. 授权号橱窗同步**真实延迟与覆盖率**,**有无任何查询 API**(无则 `observe_authorized` 恒人工确认——这决定该节点最终形态)。
9. 是否有「橱窗主推店铺」开关导致他人不可见(搜索提示有此坑)。
10. 精选联盟「新品自动加入推广」生效范围/延迟,是否有类目/体验分限制。
11. 确认开放平台对**当前个体工商户主体**是否**完全无**商品挂车 API(目前判断为无)→ 决定挂链链只建 RPA/导出。
12. RPA 在创作者中心挂「橱窗/联盟商品」的实际选择器、登录态维持成本、**封号风险阈值**。
13. 视频商品链接是否需 `haohuo` 开头(第三方口径),官方挂车 UI 是否一致。

**对 docs/09 的回写建议(可直接改):** §21.2 token URL 改抖店 + `authorization_self`;§11.1 addV2 改「含 commit 可能一步,launch 待实测」;§11.2 删 `/item/link` 视频挂载、改 RPA/导出;§13.2 佣金 90% 改 1%~50%;授权号章节补蓝V/同营业执照/≥1000粉/体验分≥4.0/店铺型迁移门槛;补 IP 白名单、图片先传素材中心、类目下钻三处遗漏。

---

相关文件(绝对路径):`C:\testji\yunyingxitong\lib\workflow\executors.js`、`C:\testji\yunyingxitong\lib\store-listing-service.js`、`C:\testji\yunyingxitong\lib\platform\adapter-factory.js`、`C:\testji\yunyingxitong\lib\platform\adapters\douyin.js`、`C:\testji\yunyingxitong\lib\platform-demo.js`、`C:\testji\yunyingxitong\lib\listing-check.js`、`C:\testji\yunyingxitong\lib\platform-observe-service.js`、`C:\testji\yunyingxitong\lib\account-utils.js`、`C:\testji\yunyingxitong\lib\workflow\machine.js`、`C:\testji\yunyingxitong\prisma\schema.prisma`、`C:\testji\yunyingxitong\.env.example`、`C:\testji\yunyingxitong\docs\09-core-platform-workflow-design.md`(§11/§13/§20/§21 待回写)。新建文件:`lib\security\secret-box.js`、`lib\platform\run-mode.js`、`lib\platform\token-manager.js`、`lib\platform\idempotency.js`、`lib\platform\douyin\shop-client.js`、`lib\repositories\credential.repo.js`。