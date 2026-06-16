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
  status?: string;
  sellingPoints?: string;
  specs?: string;
}

export interface Asset {
  id: string;
  kind: "image" | "video" | "copy";
  name?: string;
  content?: string;
  mediaUrl?: string;
}

export interface ProductDetail extends Product {
  assets: Asset[];
  productMappings: { platform: string; externalProductId: string }[];
  derivedStatus: { imageStatus: string; copyStatus: string; videoStatus: string };
}

export const api = {
  listProducts: () => request<Product[]>("/api/v2/products"),
  getProduct: (id: string) => request<ProductDetail>(`/api/v2/products/${id}`),
  listAccounts: () => request<any[]>("/api/v2/accounts"),
};
