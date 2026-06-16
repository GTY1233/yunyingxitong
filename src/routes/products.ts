import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import repos from "../repos.js";

// 商品可写字段的 JSON Schema（Fastify 用它做请求体校验 + 喂 Swagger）。
const PRODUCT_PROPS = {
  displayCode: { type: "string" },
  name: { type: "string", minLength: 1 },
  category: { type: "string" },
  priceCents: { type: "integer", minimum: 0 },
  stock: { type: "integer", minimum: 0 },
  warningStock: { type: "integer", minimum: 0 },
  sellingPoints: { type: "string" },
  specs: { type: "string" },
  platforms: { type: "array", items: { type: "string" } },
} as const;

// DTO → 仓储数据：platforms 数组转 JSON 字符串存储。
function toData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = { ...body };
  if (Array.isArray(body.platforms)) data.platforms = JSON.stringify(body.platforms);
  return data;
}

export async function productRoutes(app: FastifyInstance) {
  app.get("/api/v2/products", { schema: { tags: ["products"], summary: "商品列表" } }, async () => {
    return { ok: true, data: await repos.products.list() };
  });

  app.get<{ Params: { id: string } }>(
    "/api/v2/products/:id",
    {
      schema: {
        tags: ["products"],
        summary: "商品详情（含资产/映射/工作流 + 派生状态）",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      },
    },
    async (req) => {
      const product = await repos.products.getWithRelations(req.params.id);
      if (!product) throw AppError.notFound("商品不存在");
      const derivedStatus = await repos.status.deriveProductMediaStatus(product.id);
      return { ok: true, data: { ...product, derivedStatus } };
    }
  );

  app.post<{ Body: Record<string, unknown> }>(
    "/api/v2/products",
    {
      schema: {
        tags: ["products"],
        summary: "新建商品",
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: PRODUCT_PROPS,
        },
      },
    },
    async (req, reply) => {
      const created = await repos.products.create(toData(req.body));
      reply.status(201);
      return { ok: true, data: created };
    }
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/api/v2/products/:id",
    {
      schema: {
        tags: ["products"],
        summary: "编辑商品",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        body: { type: "object", additionalProperties: false, properties: PRODUCT_PROPS },
      },
    },
    async (req) => {
      const existing = await repos.products.getById(req.params.id);
      if (!existing) throw AppError.notFound("商品不存在");
      const updated = await repos.products.update(req.params.id, toData(req.body));
      return { ok: true, data: updated };
    }
  );
}
