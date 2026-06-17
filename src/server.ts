// 阶段二 · Fastify 新后端骨架。读端点接仓储层（SQLite），与旧 server.js 并存（绞杀者）。
// 运行：npm run dev:api（tsx watch）/ npm run start:api。默认端口 4174，旧后端仍在 4173。
import fs from "node:fs";
import path from "node:path";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import engine from "./engine.js";
import type { AppError } from "./lib/errors.js";
import { registerAuth } from "./plugins/auth.js";
import { accountRoutes } from "./routes/accounts.js";
import { assetRoutes } from "./routes/assets.js";
import { healthRoutes } from "./routes/health.js";
import { productRoutes } from "./routes/products.js";
import { statsRoutes } from "./routes/stats.js";
import { uploadRoutes } from "./routes/uploads.js";
import { workbenchRoutes } from "./routes/workbench.js";
import { workflowRoutes } from "./routes/workflows.js";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });

// 容忍空 body 的 application/json POST(节点动作类端点无 body,但前端会带 content-type)。
app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
  const s = (body as string) || "";
  if (s.trim() === "") return done(null, {});
  try {
    done(null, JSON.parse(s));
  } catch (err) {
    (err as Error & { statusCode?: number }).statusCode = 400;
    done(err as Error, undefined);
  }
});

async function main() {
  await app.register(swagger, {
    openapi: {
      info: { title: "云营系统 API（阶段二）", version: "0.1.0" },
      tags: [{ name: "products" }, { name: "accounts" }, { name: "meta" }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  // 文件上传(商品原图)
  await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024 } });

  // 媒体：抢救备份只读静态暴露，让前端能显示图/视频
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "media-backup"),
    prefix: "/media-backup/",
    decorateReply: false,
  });
  // 上传的商品原图静态暴露
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  await app.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: "/uploads/",
    decorateReply: false,
  });
  // 生成产物(模板兜底/下载的真实视频)静态暴露
  if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
  await app.register(fastifyStatic, {
    root: GENERATED_DIR,
    prefix: "/generated/",
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
  await workbenchRoutes(app);
  await productRoutes(app);
  await assetRoutes(app);
  await accountRoutes(app);
  await workflowRoutes(app);
  await uploadRoutes(app);

  // 重启后清理残留「执行中」节点(后台任务已随进程丢失)
  try {
    const recovered = await engine.recoverStuckNodes();
    if (recovered) app.log.warn(`已重置 ${recovered} 个中断的「执行中」节点为失败,可重试`);
  } catch (e) {
    app.log.error(e);
  }

  const port = Number(process.env.API_PORT || 4174);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API 已启动 http://localhost:${port}  · 文档 /docs`);
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
