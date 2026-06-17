// 桥接 JS 仓储层（lib/repositories，CommonJS）。后端只经此访问数据。
// @ts-ignore JS 模块暂无类型声明，用下方接口约束最小可用面。
import reposJs from "../lib/repositories/index.js";

interface Repos {
  products: {
    list(): Promise<any[]>;
    getById(id: string): Promise<any>;
    getByDisplayCode(code: string): Promise<any>;
    getWithRelations(id: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    softDelete(id: string): Promise<any>;
  };
  accounts: {
    list(): Promise<any[]>;
    getById(id: string): Promise<any>;
    byRole(role: string, platform?: string): Promise<any[]>;
    create(data: any): Promise<any>;
  };
  assets: {
    listByProduct(productId: string, kind?: string): Promise<any[]>;
    listAll(kind?: string): Promise<any[]>;
    getById(id: string): Promise<any>;
    create(data: any): Promise<any>;
    softDelete(id: string): Promise<any>;
    setPrimary(assetId: string, productId: string): Promise<any>;
  };
  modelImages: {
    list(): Promise<any[]>;
    getById(id: string): Promise<any>;
    create(data: any): Promise<any>;
    softDelete(id: string): Promise<any>;
  };
  referenceVideos: {
    list(): Promise<any[]>;
    getById(id: string): Promise<any>;
    create(data: any): Promise<any>;
    softDelete(id: string): Promise<any>;
  };
  workflows: {
    getByProduct(productId: string): Promise<any[]>;
    getById(id: string): Promise<any>;
    updateNodeStatus(nodeId: string, status: string, error?: string): Promise<any>;
  };
  status: {
    deriveProductMediaStatus(productId: string): Promise<any>;
    deriveWorkflowProgress(workflowId: string): Promise<number>;
  };
  stats: { dashboard(): Promise<any>; workbench(): Promise<any> };
  client: { getPrisma(): any; disconnect(): Promise<void> };
}

const repos = reposJs as Repos;
export default repos;
