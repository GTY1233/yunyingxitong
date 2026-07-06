import type { FastifyInstance } from "fastify";
// @ts-ignore CommonJS 业务模块暂无类型声明
import runMode from "../../lib/platform/run-mode.js";
import engine from "../engine.js";
import { AppError } from "../lib/errors.js";
import repos from "../repos.js";

const idParam = { type: "object", required: ["id"], properties: { id: { type: "string" } } };

// 平台 → 上架凭证通道(当前仅抖音真接;其余无凭证 → 按环境推导,默认演示)。
const PLATFORM_SHOP_API: Record<string, string> = { 抖音: "douyin_shop" };

export async function workflowRoutes(app: FastifyInstance) {
  app.get(
    "/api/v2/workflow-templates",
    { schema: { tags: ["workflows"], summary: "三平台链模板(含每平台当前运行模式)" } },
    async () => {
      const templates = engine.templates();
      const withMode = await Promise.all(
        templates.map(async (t) => {
          const api = PLATFORM_SHOP_API[t.platform];
          const cred = api ? await repos.credentials.getByApi(t.platform, api) : null;
          return { ...t, runMode: runMode.resolveRunMode(cred) as "demo" | "real" | "manual" };
        })
      );
      return { ok: true, data: withMode };
    }
  );

  // 审核中心收件箱:全部活跃工作流里等人处理的节点(待确认=审核点、失败=待重试)。
  app.get(
    "/api/v2/review-queue",
    { schema: { tags: ["workflows"], summary: "审核队列(待确认/失败节点一站式)" } },
    async () => ({ ok: true, data: await engine.reviewQueue() })
  );

  // 自动流水线开关:开启后节点成功自动推进,只停在待确认/失败。
  app.patch<{ Params: { id: string }; Body: { enable: boolean } }>(
    "/api/v2/workflows/:id/auto",
    {
      schema: {
        tags: ["workflows"],
        summary: "开/关自动流水线(开启即尝试推进当前节点)",
        params: idParam,
        body: {
          type: "object",
          required: ["enable"],
          properties: { enable: { type: "boolean" } },
        },
      },
    },
    async (req) => {
      try {
        const wf = await engine.setAutoMode(req.params.id, req.body.enable);
        return { ok: true, data: wf };
      } catch (e) {
        throw new AppError((e as Error).message, 400, "WORKFLOW_AUTO_FAILED");
      }
    }
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
  // autoRun=true:创建即开自动流水线,生成节点自动跑,停在预览确认等人审核。
  app.post<{ Body: { productId: string; platforms: string[]; autoRun?: boolean } }>(
    "/api/v2/workflows/batch",
    {
      schema: {
        tags: ["workflows"],
        summary: "批量为商品启动多平台工作流(可选自动流水线)",
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
            autoRun: { type: "boolean" },
          },
        },
      },
    },
    async (req) => {
      const { productId, platforms, autoRun } = req.body;
      const results = [];
      for (const platform of platforms) {
        try {
          const wf = await engine.createForProduct(productId, platform, { autoMode: !!autoRun });
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
            // 换装图档位:姿势(1保持原姿势/2站立)、胸部(1默认/2D-E饱满纯欲/3C标准/4A-B小巧)、
            // 腰臀比(1标准/2强化)、输出方式(1直出/2ZIP绕安审)
            poseMode: { type: "string" },
            chestMode: { type: "string" },
            waistHipMode: { type: "string" },
            outputMode: { type: "string" },
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
