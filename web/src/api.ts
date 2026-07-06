// 统一 API 客户端：读后端 {ok,data,error} 信封，出错抛带消息的 Error。
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(body?.error?.message || `请求失败（${res.status}）`);
  }
  return body.data as T;
}

export interface Product {
  id: string;
  displayCode?: string;
  name: string;
  category?: string;
  priceCents?: number;
  stock?: number;
  warningStock?: number;
  status?: string;
  sellingPoints?: string;
  specs?: string;
}

export interface Asset {
  id: string;
  kind: "image" | "video" | "copy" | "original";
  name?: string;
  content?: string;
  mediaUrl?: string;
  isAiGenerated?: boolean;
  aiNote?: string;
}

export interface ProductDetail extends Product {
  assets: Asset[];
  productMappings: { platform: string; externalProductId: string }[];
  derivedStatus: { imageStatus: string; copyStatus: string; videoStatus: string };
}

export interface Account {
  id: string;
  name?: string;
  platform?: string;
  type?: string;
  role?: string;
  auth?: string;
  rule?: string;
  isDemo?: boolean;
  publishHandle?: string;
}

// 发布素材包:一个商品生成好的可发布视频 + 文案 + 标签
export interface PublishPackage {
  productName: string;
  ready: boolean;
  videoUrl: string;
  coverUrl: string;
  title: string;
  desc: string;
  tags: string[];
  autoPublishEnabled: boolean;
}

export interface DashboardStats {
  products: number;
  lowStock: number;
  accounts: number;
  assets: number;
  productsByStatus: Record<string, number>;
  accountsByRole: Record<string, number>;
  assetsByKind: Record<string, number>;
}

export interface NewProduct {
  name: string;
  category?: string;
  priceCents?: number;
  stock?: number;
  warningStock?: number;
  sellingPoints?: string;
  specs?: string;
  platforms?: string[];
}

export interface AssetWithProduct extends Asset {
  productId: string;
  status?: string;
  type?: string;
  product?: { displayCode?: string; name?: string };
}

export interface Workbench {
  lowStock: { id: string; displayCode?: string; name: string; stock?: number; warningStock?: number }[];
  missingMedia: { id: string; displayCode?: string; name: string; missing: string[] }[];
}

export interface WorkflowNode {
  id: string;
  nodeKey: string;
  seq: number;
  label: string;
  type: string;
  kind?: string;
  status: string;
  error?: string;
}

export interface Workflow {
  id: string;
  productId: string;
  platform: string;
  template?: string;
  status?: string;
  currentNodeId?: string;
  progress: number;
  autoMode: boolean;
  nodes: WorkflowNode[];
}

export interface WorkflowTemplate {
  platform: string;
  template: string;
  stepCount: number;
  steps: string[];
  runMode: "demo" | "real" | "manual";
}

// 审核中心:自动流水线停下来等人处理的事项
export interface ReviewItem {
  nodeId: string;
  workflowId: string;
  platform: string;
  autoMode: boolean;
  productId: string;
  productName: string;
  displayCode: string;
  nodeLabel: string;
  nodeType: string;
  kind: string;
  status: "待确认" | "失败";
  error: string;
  hint: string;
  updatedAt: string;
}

export interface ReviewQueue {
  items: ReviewItem[];
  counts: { pending: number; failed: number };
}

export interface BatchLaunchResult {
  platform: string;
  ok: boolean;
  workflowId?: string;
  status?: string;
  error?: string;
}

export interface ModelImage {
  id: string;
  name?: string;
  mediaUrl: string;
}

export type ReferenceVideo = ModelImage;

// 平台凭证(脱敏视图,后端绝不返明文/密文)
export interface PlatformCredential {
  id: string;
  platform: string;
  api: string;
  label: string;
  role: string;
  appKey: string;
  appSecretSet: boolean;
  shopId: string;
  runMode: "demo" | "real" | "manual";
  status: string;
  lastError: string;
  tokenSet: boolean;
  tokenExpiresAt: string | null;
}

export interface CredentialConfigInput {
  platform: string;
  api: string;
  label?: string;
  role?: string;
  appKey?: string;
  appSecret?: string;
}

export interface CredentialTokenInput {
  accessToken: string;
  refreshToken?: string;
  shopId?: string;
  expiresInSec?: number;
  refreshExpiresInSec?: number;
}

export interface OAuthGuide {
  flow: string;
  authConsole: string;
  tokenTemplate: string;
  steps: string[];
  note: string;
}

export const api = {
  getStats: () => request<DashboardStats>("/api/v2/stats"),
  getWorkbench: () => request<Workbench>("/api/v2/workbench"),
  listWorkflowTemplates: () => request<WorkflowTemplate[]>("/api/v2/workflow-templates"),
  listWorkflows: (productId: string) =>
    request<Workflow[]>(`/api/v2/products/${productId}/workflows`),
  createWorkflow: (productId: string, platform: string) =>
    request<Workflow>("/api/v2/workflows", {
      method: "POST",
      body: JSON.stringify({ productId, platform }),
    }),
  batchLaunchWorkflows: (productId: string, platforms: string[], autoRun?: boolean) =>
    request<{ productId: string; results: BatchLaunchResult[] }>("/api/v2/workflows/batch", {
      method: "POST",
      body: JSON.stringify({ productId, platforms, autoRun }),
    }),
  getReviewQueue: () => request<ReviewQueue>("/api/v2/review-queue"),
  setWorkflowAuto: (id: string, enable: boolean) =>
    request<Workflow>(`/api/v2/workflows/${id}/auto`, {
      method: "PATCH",
      body: JSON.stringify({ enable }),
    }),
  workflowAction: (
    workflowId: string,
    nodeId: string,
    action: string,
    params: Record<string, unknown> = {}
  ) =>
    request<Workflow>(`/api/v2/workflows/${workflowId}/nodes/${nodeId}/${action}`, {
      method: "POST",
      body: JSON.stringify(params),
    }),
  listModelImages: () => request<ModelImage[]>("/api/v2/model-images"),
  uploadModelImage: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/v2/model-images", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body?.error?.message || `上传失败（${res.status}）`);
    return body.data as ModelImage;
  },
  deleteModelImage: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/api/v2/model-images/${id}`, { method: "DELETE" }),
  listReferenceVideos: () => request<ReferenceVideo[]>("/api/v2/reference-videos"),
  uploadReferenceVideo: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/v2/reference-videos", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body?.error?.message || `上传失败（${res.status}）`);
    return body.data as ReferenceVideo;
  },
  deleteReferenceVideo: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/api/v2/reference-videos/${id}`, { method: "DELETE" }),
  listAssets: (kind?: string) =>
    request<AssetWithProduct[]>(`/api/v2/assets${kind ? `?kind=${kind}` : ""}`),
  listProducts: () => request<Product[]>("/api/v2/products"),
  getProduct: (id: string) => request<ProductDetail>(`/api/v2/products/${id}`),
  createProduct: (body: NewProduct) =>
    request<Product>("/api/v2/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id: string, body: Partial<NewProduct>) =>
    request<Product>(`/api/v2/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/api/v2/products/${id}`, { method: "DELETE" }),
  uploadProductImage: async (productId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/v2/products/${productId}/images`, { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body?.error?.message || `上传失败（${res.status}）`);
    return body.data as Asset;
  },
  deleteAsset: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/api/v2/assets/${id}`, { method: "DELETE" }),
  listAccounts: () => request<Account[]>("/api/v2/accounts"),
  setAccountPublishHandle: (id: string, publishHandle: string) =>
    request<Account>(`/api/v2/accounts/${id}/publish-handle`, {
      method: "PATCH",
      body: JSON.stringify({ publishHandle }),
    }),
  getPublishPackage: (productId: string) =>
    request<PublishPackage>(`/api/v2/products/${productId}/publish-package`),
  listCredentials: () => request<PlatformCredential[]>("/api/v2/platform-credentials"),
  saveCredential: (body: CredentialConfigInput) =>
    request<PlatformCredential>("/api/v2/platform-credentials", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  setCredentialRunMode: (id: string, runMode: string) =>
    request<PlatformCredential>(`/api/v2/platform-credentials/${id}/run-mode`, {
      method: "PATCH",
      body: JSON.stringify({ runMode }),
    }),
  saveCredentialTokens: (id: string, body: CredentialTokenInput) =>
    request<PlatformCredential>(`/api/v2/platform-credentials/${id}/tokens`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getCredentialOAuthUrl: (id: string) =>
    request<OAuthGuide>(`/api/v2/platform-credentials/${id}/oauth-url`),
  deleteCredential: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/api/v2/platform-credentials/${id}`, {
      method: "DELETE",
    }),
};
