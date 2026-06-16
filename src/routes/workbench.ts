import type { FastifyInstance } from "fastify";
import repos from "../repos.js";

export async function workbenchRoutes(app: FastifyInstance) {
  app.get(
    "/api/v2/workbench",
    { schema: { tags: ["meta"], summary: "工作台待办（库存预警 + 缺素材）" } },
    async () => {
      return { ok: true, data: await repos.stats.workbench() };
    }
  );
}
