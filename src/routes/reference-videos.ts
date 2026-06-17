import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import repos from "../repos.js";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const EXT: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/x-m4v": ".m4v",
  "video/webm": ".webm",
};

export async function referenceVideoRoutes(app: FastifyInstance) {
  app.get(
    "/api/v2/reference-videos",
    { schema: { tags: ["reference-videos"], summary: "参考视频库列表" } },
    async () => ({ ok: true, data: await repos.referenceVideos.list() })
  );

  app.post(
    "/api/v2/reference-videos",
    { schema: { tags: ["reference-videos"], summary: "上传参考视频(multipart,字段名 file)" } },
    async (req, reply) => {
      const file = await req.file();
      if (!file) throw AppError.badRequest("缺少文件");
      const ext = EXT[file.mimetype];
      if (!ext) throw AppError.badRequest("仅支持 mp4/mov/m4v/webm 视频");
      const buf = await file.toBuffer();
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const fname = `refvideo-${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fname), buf);
      const rv = await repos.referenceVideos.create({
        name: file.filename || fname,
        mediaUrl: `uploads/${fname}`,
      });
      reply.status(201);
      return { ok: true, data: rv };
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v2/reference-videos/:id",
    {
      schema: {
        tags: ["reference-videos"],
        summary: "删除参考视频(软删除)",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      },
    },
    async (req) => {
      const rv = await repos.referenceVideos.getById(req.params.id);
      if (!rv) throw AppError.notFound("参考视频不存在");
      await repos.referenceVideos.softDelete(req.params.id);
      return { ok: true, data: { id: req.params.id, deleted: true } };
    }
  );
}
