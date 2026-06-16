import type { FastifyInstance } from "fastify";
import repos from "../repos.js";

export async function statsRoutes(app: FastifyInstance) {
  app.get("/api/v2/stats", { schema: { tags: ["meta"], summary: "工作台统计计数" } }, async () => {
    return { ok: true, data: await repos.stats.dashboard() };
  });
}
