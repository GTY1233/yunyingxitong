import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import repos from "../repos.js";

export async function productRoutes(app: FastifyInstance) {
  app.get("/api/v2/products", { schema: { tags: ["products"], summary: "商品列表" } }, async () => {
    const data = await repos.products.list();
    return { ok: true, data };
  });

  app.get<{ Params: { id: string } }>(
    "/api/v2/products/:id",
    {
      schema: {
        tags: ["products"],
        summary: "商品详情（含资产/映射/工作流 + 派生状态）",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (req) => {
      const product = await repos.products.getWithRelations(req.params.id);
      if (!product) throw AppError.notFound("商品不存在");
      const derivedStatus = await repos.status.deriveProductMediaStatus(product.id);
      return { ok: true, data: { ...product, derivedStatus } };
    }
  );
}
