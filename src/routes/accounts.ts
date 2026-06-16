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
}
