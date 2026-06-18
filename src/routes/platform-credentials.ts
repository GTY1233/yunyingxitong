// 平台凭证配置 API。无 key 也能用:先建配置(demo/manual 跑通),办好 key 后回这里
// 填 appKey/appSecret + 贴 token,把 runMode 切 real 即转真实。secret/token 一律加密落库,
// 出参经 maskView 脱敏(绝不返明文/密文)。详见 docs/13 §4/§6。
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import repos from "../repos.js";

// 目前已规划的 API 通道:抖店主店上架(douyin_shop)/ 抖音开放平台发布(douyin_open)。
const VALID_API = ["douyin_shop", "douyin_open"] as const;
const VALID_RUN_MODE = ["demo", "real", "manual"] as const;

// 抖店自用型应用:在服务市场授权自身店铺后取 token(无标准网页 OAuth 回跳,故以「手动贴 token」为主路径)。
const DOUYIN_AUTH_CONSOLE = "https://fuwu.jinritemai.com/";
const DOUYIN_TOKEN_HOST = "https://openapi-fxg.jinritemai.com";

export async function platformCredentialRoutes(app: FastifyInstance) {
  // 列表(脱敏)
  app.get(
    "/api/v2/platform-credentials",
    { schema: { tags: ["platform-credentials"], summary: "平台凭证列表(脱敏)" } },
    async () => {
      const list = await repos.credentials.list();
      return { ok: true, data: list.map((c) => repos.credentials.maskView(c)) };
    }
  );

  // 新建/更新某 (platform, api) 的配置。appSecret 仅在提供时加密更新。
  app.post<{
    Body: {
      platform: string;
      api: string;
      label?: string;
      role?: string;
      appKey?: string;
      appSecret?: string;
    };
  }>(
    "/api/v2/platform-credentials",
    {
      schema: {
        tags: ["platform-credentials"],
        summary: "配置平台凭证(upsert,按 platform+api 唯一)",
        body: {
          type: "object",
          required: ["platform", "api"],
          properties: {
            platform: { type: "string" },
            api: { type: "string", enum: VALID_API as unknown as string[] },
            label: { type: "string" },
            role: { type: "string" },
            appKey: { type: "string" },
            appSecret: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { appSecret } = req.body;
      let saved: Awaited<ReturnType<typeof repos.credentials.upsertConfig>>;
      try {
        saved = await repos.credentials.upsertConfig(req.body);
      } catch (e) {
        // 唯一会失败的点:填了 appSecret 但没配主密钥 → 给清晰指引,不抛 500
        if (appSecret && /PLATFORM_CRED_ENC_KEY/.test((e as Error).message)) {
          throw AppError.badRequest((e as Error).message);
        }
        throw e;
      }
      reply.status(201);
      return { ok: true, data: repos.credentials.maskView(saved) };
    }
  );

  // 切换运行模式 demo/real/manual。切 real 但凭证不全时,执行器会自动降级 manual(见 run-mode.js)。
  app.patch<{ Params: { id: string }; Body: { runMode: string } }>(
    "/api/v2/platform-credentials/:id/run-mode",
    {
      schema: {
        tags: ["platform-credentials"],
        summary: "切换运行模式 demo/real/manual",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        body: {
          type: "object",
          required: ["runMode"],
          properties: { runMode: { type: "string", enum: VALID_RUN_MODE as unknown as string[] } },
        },
      },
    },
    async (req) => {
      const c = await repos.credentials.getById(req.params.id);
      if (!c) throw AppError.notFound("凭证不存在");
      const updated = await repos.credentials.setRunMode(req.params.id, req.body.runMode);
      return { ok: true, data: repos.credentials.maskView(updated) };
    }
  );

  // 手动贴 token(自用型应用主路径):在抖店后台授权自身店铺后,把 access_token/refresh_token 贴进来。
  app.post<{
    Params: { id: string };
    Body: {
      accessToken: string;
      refreshToken?: string;
      shopId?: string;
      expiresInSec?: number;
      refreshExpiresInSec?: number;
    };
  }>(
    "/api/v2/platform-credentials/:id/tokens",
    {
      schema: {
        tags: ["platform-credentials"],
        summary: "手动保存平台 token(加密落库,设过期,状态置已授权)",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        body: {
          type: "object",
          required: ["accessToken"],
          properties: {
            accessToken: { type: "string", minLength: 1 },
            refreshToken: { type: "string" },
            shopId: { type: "string" },
            expiresInSec: { type: "number" },
            refreshExpiresInSec: { type: "number" },
          },
        },
      },
    },
    async (req) => {
      const c = await repos.credentials.getById(req.params.id);
      if (!c) throw AppError.notFound("凭证不存在");
      try {
        const updated = await repos.credentials.saveTokens(req.params.id, req.body);
        return { ok: true, data: repos.credentials.maskView(updated) };
      } catch (e) {
        if (/PLATFORM_CRED_ENC_KEY/.test((e as Error).message)) {
          throw AppError.badRequest((e as Error).message);
        }
        throw e;
      }
    }
  );

  // OAuth 指引(骨架):自用型应用以手动贴 token 为主;此处给出授权入口与 token 接口模板,便于办好后接入。
  app.get<{ Params: { id: string } }>(
    "/api/v2/platform-credentials/:id/oauth-url",
    {
      schema: {
        tags: ["platform-credentials"],
        summary: "获取授权指引(自用型应用走手动贴 token)",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      },
    },
    async (req) => {
      const c = await repos.credentials.getById(req.params.id);
      if (!c) throw AppError.notFound("凭证不存在");
      const tokenTemplate = c.appKey
        ? `${DOUYIN_TOKEN_HOST}/token/create?grant_type=authorization_self&app_id=${c.appKey}&app_secret=***&code=***`
        : `${DOUYIN_TOKEN_HOST}/token/create?grant_type=authorization_self&app_id=<appKey>&app_secret=<secret>&code=<code>`;
      return {
        ok: true,
        data: {
          flow: "douyin_self_use",
          authConsole: DOUYIN_AUTH_CONSOLE,
          tokenTemplate,
          steps: [
            "在抖店服务市场创建「自用型」应用,绑定本店铺",
            "拿到 app_key / app_secret,先在本页保存配置",
            "在抖店后台完成自身店铺授权,获取 access_token(及 refresh_token)",
            "回本页用「手动贴 token」保存,系统加密落库并置为已授权",
            "把运行模式切到 real 即转真实调用",
          ],
          note: "真实 token 自动获取/刷新待接入(token-manager 现为占位),当前以手动贴 token 为准。",
        },
      };
    }
  );

  // 删除(软删除)
  app.delete<{ Params: { id: string } }>(
    "/api/v2/platform-credentials/:id",
    {
      schema: {
        tags: ["platform-credentials"],
        summary: "删除平台凭证(软删除)",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      },
    },
    async (req) => {
      const c = await repos.credentials.getById(req.params.id);
      if (!c) throw AppError.notFound("凭证不存在");
      await repos.credentials.softDelete(req.params.id);
      return { ok: true, data: { id: req.params.id, deleted: true } };
    }
  );
}
