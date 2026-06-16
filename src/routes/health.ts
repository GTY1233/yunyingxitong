import type { FastifyInstance } from "fastify";
import repos from "../repos.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", { schema: { tags: ["meta"] } }, async () => {
    let dbOk = false;
    try {
      await repos.client.getPrisma().$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    return {
      ok: dbOk,
      service: "yunyingxitong-api",
      db: dbOk ? "ok" : "down",
      uptimeSec: Math.round(process.uptime()),
    };
  });
}
