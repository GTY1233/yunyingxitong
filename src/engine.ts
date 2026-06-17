// 桥接工作流引擎服务(lib/workflow/service.js,CommonJS)。
// @ts-ignore JS 模块暂无类型声明
import engineJs from "../lib/workflow/service.js";

interface Engine {
  templates(): { platform: string; template: string; stepCount: number; steps: string[] }[];
  getWorkflow(id: string): Promise<any>;
  getForProduct(productId: string): Promise<any[]>;
  createForProduct(productId: string, platform: string): Promise<any>;
  act(workflowId: string, nodeId: string, action: string, opts?: { sync?: boolean }): Promise<any>;
  recoverStuckNodes(): Promise<number>;
}

const engine = engineJs as Engine;
export default engine;
