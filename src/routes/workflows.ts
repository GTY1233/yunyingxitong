import type { FastifyInstance } from "fastify";
import engine from "../engine.js";
import { AppError } from "../lib/errors.js";

const idParam = { type: "object", required: ["id"], properties: { id: { type: "string" } } };

export async function workflowRoutes(app: FastifyInstance) {
  app.get(
    "/api/v2/workflow-templates",
    { schema: { tags: ["workflows"], summary: "三平台链模板" } },
    async () => ({ ok: true, data: engine.templates() })
  );

  app.get<{ Params: { id: string } }>(
    "/api/v2/products/:id/workflows",
    { schema: { tags: ["workflows"], summary: "商品的平台工作流", params: idParam } },
    async (req) => ({ ok: true, data: await engine.getForProduct(req.params.id) })
  );

  app.post<{ Body: { productId: string; platform: string } }>(
    "/api/v2/workflows",
    {
      schema: {
        tags: ["workflows"],
        summary: "创建平台工作流",
        body: {
          type: "object",
          required: ["productId", "platform"],
          additionalProperties: false,
          properties: {
            productId: { type: "string" },
            platform: { type: "string", enum: ["抖音", "小红书", "淘宝"] },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const wf = await engine.createForProduct(req.body.productId, req.body.platform);
        reply.status(201);
        return { ok: true, data: wf };
      } catch (e) {
        throw new AppError((e as Error).message, 400, "WORKFLOW_CREATE_FAILED");
      }
    }
  );

  app.get<{ Params: { id: string } }>(
    "/api/v2/workflows/:id",
    { schema: { tags: ["workflows"], params: idParam } },
    async (req) => {
      const wf = await engine.getWorkflow(req.params.id);
      if (!wf) throw AppError.notFound("工作流不存在");
      return { ok: true, data: wf };
    }
  );

  app.post<{ Params: { id: string; nodeId: string; action: string } }>(
    "/api/v2/workflows/:id/nodes/:nodeId/:action",
    {
      schema: {
        tags: ["workflows"],
        summary: "节点动作 execute|confirm|skip|retry",
        params: {
          type: "object",
          required: ["id", "nodeId", "action"],
          properties: {
            id: { type: "string" },
            nodeId: { type: "string" },
            action: { type: "string", enum: ["execute", "confirm", "skip", "retry"] },
          },
        },
      },
    },
    async (req) => {
      try {
        const wf = await engine.act(req.params.id, req.params.nodeId, req.params.action);
        return { ok: true, data: wf };
      } catch (e) {
        throw new AppError((e as Error).message, 400, "WORKFLOW_ACTION_FAILED");
      }
    }
  );
}
