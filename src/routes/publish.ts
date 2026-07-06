// 发布素材导出:把审核通过的成品(视频+标题+正文+标签+封面)整理好,供手动去网页版发,
// 或作为 social-auto-upload 自动发的同一份来源。只返 URL,不泄服务器绝对路径。
import type { FastifyInstance } from "fastify";
// @ts-ignore JS 业务模块暂无类型
import publishPayload from "../../lib/publish/publish-payload.js";
// @ts-ignore
import socialUploader from "../../lib/publish/social-uploader.js";
import { AppError } from "../lib/errors.js";
import repos from "../repos.js";

export async function publishRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/v2/products/:id/publish-package",
    {
      schema: {
        tags: ["publish"],
        summary: "商品发布素材包(视频/封面/标题/正文/标签,供手动发或自动发)",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      },
    },
    async (req) => {
      const product = await repos.products.getById(req.params.id);
      if (!product) throw AppError.notFound("商品不存在");
      const p = await publishPayload.buildPublishPayload(product, { requireVideo: false });
      return {
        ok: true,
        data: {
          productName: p.productName || product.name,
          ready: !!p.videoUrl, // 有视频才算可发
          videoUrl: p.videoUrl || "",
          coverUrl: p.coverUrl || "",
          title: p.title || "",
          desc: p.desc || "",
          tags: p.tags || [],
          autoPublishEnabled: socialUploader.config().enabled, // 是否已接 social-auto-upload
        },
      };
    }
  );
}
