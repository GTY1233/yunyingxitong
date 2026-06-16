// 最小鉴权：设了 API_AUTH_TOKEN 就要求 /api/v2/* 带 Bearer；未设则开放（仅开发）。
// 阶段二后续换成 session+cookie；此处先堵住「新后端 API 裸奔」。
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";

export async function registerAuth(app: FastifyInstance) {
  const token = process.env.API_AUTH_TOKEN;
  if (!token) {
    app.log.warn("API_AUTH_TOKEN 未设置：/api/v2/* 暂时开放（仅限开发环境）");
    return;
  }
  app.addHook("onRequest", async (req) => {
    if (!req.url.startsWith("/api/v2/")) return;
    if (req.headers.authorization !== `Bearer ${token}`) {
      throw AppError.unauthorized("无效或缺失的 API Token");
    }
  });
}
