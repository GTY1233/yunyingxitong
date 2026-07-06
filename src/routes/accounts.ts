import type { FastifyInstance } from "fastify";
import repos from "../repos.js";

export async function accountRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { role?: string; platform?: string } }>(
    "/api/v2/accounts",
    {
      schema: {
        tags: ["accounts"],
        summary: "账号列表（可按矩阵角色筛选）",
        querystring: {
          type: "object",
          properties: {
            role: { type: "string", description: "main_shop | authorized | creator" },
            platform: { type: "string" },
          },
        },
      },
    },
    async (req) => {
      const { role, platform } = req.query;
      const data = role ? await repos.accounts.byRole(role, platform) : await repos.accounts.list();
      return { ok: true, data };
    }
  );

  // 设置账号的「发布名」——对应 social-auto-upload 登录时用的 --account 名(用于定位已登录 cookie)。
  app.patch<{ Params: { id: string }; Body: { publishHandle: string } }>(
    "/api/v2/accounts/:id/publish-handle",
    {
      schema: {
        tags: ["accounts"],
        summary: "设置账号的 social-auto-upload 发布名",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        body: {
          type: "object",
          required: ["publishHandle"],
          properties: { publishHandle: { type: "string" } },
        },
      },
    },
    async (req) => {
      const acc = await repos.accounts.getById(req.params.id);
      if (!acc) return { ok: false, error: { code: "NOT_FOUND", message: "账号不存在" } };
      const updated = await repos.accounts.update(req.params.id, {
        publishHandle: req.body.publishHandle.trim() || null,
      });
      return { ok: true, data: updated };
    }
  );
}
