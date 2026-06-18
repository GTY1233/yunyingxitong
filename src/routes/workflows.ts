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

  // 批量启动:一个商品 × 多平台,逐平台建链;已存在进行中链的平台不算硬失败,返回其原因。
  app.post<{ Body: { productId: string; platforms: string[] } }>(
    "/api/v2/workflows/batch",
    {
      schema: {
        tags: ["workflows"],
        summary: "批量为商品启动多平台工作流",
        body: {
          type: "object",
          required: ["productId", "platforms"],
          additionalProperties: false,
          properties: {
            productId: { type: "string" },
            platforms: {
              type: "array",
              minItems: 1,
              items: { type: "string", enum: ["抖音", "小红书", "淘宝"] },
            },
          },
        },
      },
    },
    async (req) => {
      const { productId, platforms } = req.body;
      const results = [];
      for (const platform of platforms) {
        try {
          const wf = await engine.createForProduct(productId, platform);
          results.push({ platform, ok: true, workflowId: wf.id, status: wf.status });
        } catch (e) {
          results.push({ platform, ok: false, error: (e as Error).message });
        }
      }
      return { ok: true, data: { productId, results } };
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

  app.post<{
    Params: { id: string; nodeId: string; action: string };
    Body: Record<string, unknown>;
  }>(
    "/api/v2/workflows/:id/nodes/:nodeId/:action",
    {
      schema: {
        tags: ["workflows"],
        summary: "节点动作 execute|confirm|skip|retry(execute 可带生成参数)",
        params: {
          type: "object",
          required: ["id", "nodeId", "action"],
          properties: {
            id: { type: "string" },
            nodeId: { type: "string" },
            action: { type: "string", enum: ["execute", "confirm", "skip", "retry", "rearm"] },
          },
        },
        // 生成参数(execute 用):图=模特/提示词;文案=提示词/条数;视频=参考视频/微调参数
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            modelImageId: { type: "string" },
            prompt: { type: "string" },
            versionCount: { type: "integer", minimum: 1, maximum: 5 },
            referenceVideoId: { type: "string" },
            frameRate: { type: "integer" },
            seconds: { type: "integer" },
            videoWidth: { type: "integer" },
            videoHeight: { type: "integer" },
            mode: { type: "integer" },
            expressionIntensity: { type: "number" },
            ruKilnAmplitude: { type: "number" },
          },
        },
      },
    },
    async (req) => {
      try {
        const wf = await engine.act(
          req.params.id,
          req.params.nodeId,
          req.params.action,
          req.body || {}
        );
        return { ok: true, data: wf };
      } catch (e) {
        throw new AppError((e as Error).message, 400, "WORKFLOW_ACTION_FAILED");
      }
    }
  );
}
