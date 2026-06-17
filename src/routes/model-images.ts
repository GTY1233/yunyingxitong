import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import repos from "../repos.js";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export async function modelImageRoutes(app: FastifyInstance) {
  app.get(
    "/api/v2/model-images",
    { schema: { tags: ["model-images"], summary: "模特图库列表" } },
    async () => ({ ok: true, data: await repos.modelImages.list() })
  );

  app.post(
    "/api/v2/model-images",
    { schema: { tags: ["model-images"], summary: "上传模特图(multipart,字段名 file)" } },
    async (req, reply) => {
      const file = await req.file();
      if (!file) throw AppError.badRequest("缺少文件");
      const ext = EXT[file.mimetype];
      if (!ext) throw AppError.badRequest("仅支持 png/jpg/webp/gif 图片");
      const buf = await file.toBuffer();
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const fname = `model-${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fname), buf);
      const model = await repos.modelImages.create({
        name: file.filename || fname,
        mediaUrl: `uploads/${fname}`,
      });
      reply.status(201);
      return { ok: true, data: model };
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v2/model-images/:id",
    {
      schema: {
        tags: ["model-images"],
        summary: "删除模特图(软删除)",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      },
    },
    async (req) => {
      const m = await repos.modelImages.getById(req.params.id);
      if (!m) throw AppError.notFound("模特图不存在");
      await repos.modelImages.softDelete(req.params.id);
      return { ok: true, data: { id: req.params.id, deleted: true } };
    }
  );
}
