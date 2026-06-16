import type { FastifyInstance } from "fastify";
import repos from "../repos.js";

export async function assetRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { kind?: string } }>(
    "/api/v2/assets",
    {
      schema: {
        tags: ["assets"],
        summary: "全量素材（含所属商品，可按 kind 筛选）",
        querystring: {
          type: "object",
          properties: { kind: { type: "string", description: "image | video | copy" } },
        },
      },
    },
    async (req) => {
      return { ok: true, data: await repos.assets.listAll(req.query.kind) };
    }
  );
}
