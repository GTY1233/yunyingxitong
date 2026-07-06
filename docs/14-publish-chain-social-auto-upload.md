# 发布链路接入(social-auto-upload)

> 官方发布 API 已死(抖音 2024-07 收回代投稿、小红书从无对外发布 API),内容自动发布只能走浏览器自动化。本系统用 [social-auto-upload](https://github.com/dreammis/social-auto-upload)(13k★,Playwright/patchright)作真发引擎。

## 三态(与平台上架一致)

发布节点每个矩阵号按条件自动选:

| 模式 | 触发条件 | 行为 |
|------|----------|------|
| **real** | `SAU_ENABLED=1` + 平台可映射 + 账号有发布名 | 调 `sau <platform> upload-video` 真发 |
| **manual** | 未满足 real | 产「导出发布包」,待人工去网页版发(`GET /api/v2/products/:id/publish-package`) |
| **demo** | 无生成密钥(演示环境) | 假成功跑通 |

> ⚠️ **风险**:浏览器自动化违反平台条款、有风控。**只对矩阵小号用;主号/绑店号建议手动(manual/网页版)。** 情趣内衣 × AI × 多账号自动化三重高危,小红书 2026 新规「全程 AI 托管封号」——克制:单号低频、内容差异化、勾 AIGC 标识。

## 用户一次性配置(办好这些 real 模式才生效)

1. **装 social-auto-upload**(需 Python + Playwright):按其 README `pip install` / 克隆并装依赖,确保 `sau` 命令可用(或用 `python cli_main.py`)。
2. **每个号登录一次**(扫码存 cookie):
   ```
   sau douyin login --account 我的抖音小号1
   sau xiaohongshu login --account 我的小红书号1
   ```
3. **系统里把号的「发布名」对齐**:平台账号页给每个账号填 `publishHandle` = 上面登录用的 `--account` 名(留空则用账号名)。
4. **开启并配置**(`.env`):
   ```
   SAU_ENABLED=1
   SAU_CLI=sau                 # 或 "python /path/to/cli_main.py"
   SAU_CWD=/path/to/social-auto-upload   # cookie/工作目录
   SAU_TIMEOUT_MS=300000       # 单条上传超时(默认5分钟)
   ```

配好后:审核通过 → 发布节点自动对每个已映射的号执行 `sau ... upload-video --file <视频> --title <标题> --desc <正文> --tags <标签>`。失败的号进「审核中心」可重试。

## 平台名映射

抖音→`douyin`、小红书→`xiaohongshu`、快手→`kuaishou`、视频号→`tencent`、B站→`bilibili`(见 `lib/publish/social-uploader.js` PLATFORM_MAP)。

## 导出发布包(manual / 手动发)

没接 social-auto-upload、或想手动发时:`GET /api/v2/products/:id/publish-package` 返回 `{ videoUrl, coverUrl, title, desc, tags }` —— 下载视频、复制标题/正文/标签,去抖音创作者中心 / 小红书创作服务平台网页版上传+定时发布(零条款风险)。

## 相关文件

- `lib/publish/publish-payload.js` — 载荷组装(视频/封面/标题/正文/标签)
- `lib/publish/social-uploader.js` — sau 命令构造 + spawn + 三态判定
- `lib/workflow/platform-executors.js` `executePublishNode` — 发布节点三态编排
- `src/routes/publish.ts` — 导出包端点
- `tests/publish-chain.test.js` — 离线测试(载荷/命令/三态)
