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

export async function uploadRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/v2/products/:id/images",
    {
      schema: {
        tags: ["uploads"],
        summary: "上传商品原图(multipart/form-data,字段名 file)",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      },
    },
    async (req, reply) => {
      const product = await repos.products.getById(req.params.id);
      if (!product) throw AppError.notFound("商品不存在");

      const file = await req.file();
      if (!file) throw AppError.badRequest("缺少文件");
      const ext = EXT[file.mimetype];
      if (!ext) throw AppError.badRequest("仅支持 png/jpg/webp/gif 图片");

      const buf = await file.toBuffer();
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const fname = `${product.id}-${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fname), buf);

      const asset = await repos.assets.create({
        productId: product.id,
        kind: "original",
        type: "商品原图",
        name: file.filename || fname,
        status: "已上传",
        provider: "upload",
        mediaUrl: `uploads/${fname}`,
      });
      reply.status(201);
      return { ok: true, data: asset };
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v2/assets/:id",
    {
      schema: {
        tags: ["uploads"],
        summary: "删除素材(软删除)",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      },
    },
    async (req) => {
      const asset = await repos.assets.getById(req.params.id);
      if (!asset) throw AppError.notFound("素材不存在");
      await repos.assets.softDelete(req.params.id);
      return { ok: true, data: { id: req.params.id, deleted: true } };
    }
  );
}
