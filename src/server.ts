// 阶段二 · Fastify 新后端骨架。读端点接仓储层（SQLite），与旧 server.js 并存（绞杀者）。
// 运行：npm run dev:api（tsx watch）/ npm run start:api。默认端口 4174，旧后端仍在 4173。
import path from "node:path";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import type { AppError } from "./lib/errors.js";
import { registerAuth } from "./plugins/auth.js";
import { accountRoutes } from "./routes/accounts.js";
import { healthRoutes } from "./routes/health.js";
import { productRoutes } from "./routes/products.js";
import { statsRoutes } from "./routes/stats.js";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });

async function main() {
  await app.register(swagger, {
    openapi: {
      info: { title: "云营系统 API（阶段二）", version: "0.1.0" },
      tags: [{ name: "products" }, { name: "accounts" }, { name: "meta" }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  // 媒体：抢救备份只读静态暴露，让前端能显示图/视频
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "media-backup"),
    prefix: "/media-backup/",
    decorateReply: false,
  });

  // 统一错误处理
  app.setErrorHandler((err, _req, reply) => {
    const e = err as AppError & { statusCode?: number };
    const status = e.statusCode || 500;
    if (status >= 500) app.log.error(e);
    reply
      .status(status)
      .send({ ok: false, error: { code: e.code || "INTERNAL", message: e.message } });
  });

  await registerAuth(app);
  await healthRoutes(app);
  await statsRoutes(app);
  await productRoutes(app);
  await accountRoutes(app);

  const port = Number(process.env.API_PORT || 4174);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API 已启动 http://localhost:${port}  · 文档 /docs`);
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
