# RunningHub v2 AI App 接入说明

## 当前接入方式

系统按 RunningHub v2 AI App 调用，不再按旧的 `text-to-image` / `text-to-video` 路由拼接。

- 提交任务：`POST /openapi/v2/run/ai-app/{appId}`
- 查询任务：`POST /openapi/v2/query`
- 本地素材上传：`POST /openapi/v2/media/upload/binary`

后端统一在 `lib/runninghub-client.js` 处理鉴权、素材上传、任务提交和轮询。

## 环境变量

```bash
RUNNINGHUB_API_KEY=
RUNNINGHUB_BASE_URL=https://www.runninghub.cn
RUNNINGHUB_IMAGE_APP_ID=2019050132657934337
RUNNINGHUB_VIDEO_APP_ID=1975951975441412098

# 视频工作流必需：参考视频，可在页面单次填写，也可全局配置
RUNNINGHUB_VIDEO_REFERENCE_VIDEO=

# 上传接口返回 download_url / fileName，两者不一致时可切换
RUNNINGHUB_UPLOAD_VALUE_FIELD=download_url
```

## 生图节点映射

生图 AI App ID：`2019050132657934337`

| nodeId | fieldName | 系统来源 |
| --- | --- | --- |
| 41 | image | 商品原图第 1 张 |
| 79 | image | 商品原图第 2 张，不足时复用第 1 张 |
| 81 | image | 商品原图第 3 张，不足时复用第 1 张 |
| 68 | prompt | 系统根据商品资料和用户生成要求组装 |
| 104 | value | 默认 `1` |

注意：示例里的换装提示词包含不适合生产系统直接复用的表达，系统实际使用安全的商品换图/电商图生成提示词。

## 生视频节点映射

生视频 AI App ID：`1975951975441412098`

| nodeId | fieldName | 系统来源 |
| --- | --- | --- |
| 275 | video | 页面填写的参考视频 URL/RH 文件名，或 `RUNNINGHUB_VIDEO_REFERENCE_VIDEO` |
| 299 | image | 商品原图第 1 张 |
| 370 | value | 运镜开关 |
| 361 | value | 运镜强度 |
| 334 | select | 输出方式 |
| 265 | value | 表情强度 |
| 297 | value | 姿势强度 |
| 264 | value | 帧率 |
| 300 | value | 加载帧数上限 |

其他节点先按 RunningHub 示例默认值传入，后续只有在运营上确实需要调参时再暴露到页面。

## 仍缺的外部能力

1. RunningHub 视频参考素材：当前视频工作流要求 `video` 节点，系统已有图片上传，但还没有“参考视频素材库”。短期可在页面填 RH 文件名或公网 URL；长期应补一个视频素材上传入口。
2. 平台上架真实接口：抖店 `/product/addV2`、`/product/launch` 等权限和签名参数还未接入。
3. 平台视频发布真实接口或 RPA：抖音/小红书发布目前仍是任务占位。
4. RunningHub 输出文件转存：RunningHub 结果 URL 有 24 小时有效期，生产环境需要下载到自己的对象存储。
