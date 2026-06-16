import { describe, expect, it } from "vitest";
import { computeListingCompleteness } from "../lib/listing-check.js";

const baseProduct = {
  id: "P1",
  name: "测试杯",
  category: "家居日用",
  price: 99,
  stock: 50,
  sellingPoints: "保温 12 小时",
  specs: "500ml/不锈钢",
  platforms: ["抖音"],
  imageStatus: "已生成",
  copyStatus: "已生成",
};

function makeDb(product, assets = []) {
  return { products: [product], assets };
}

describe("computeListingCompleteness", () => {
  it("商品不存在返回 0", () => {
    const r = computeListingCompleteness({ products: [], assets: [] }, "X");
    expect(r.completeness).toBe(0);
  });

  it("信息齐全 + 有主图与文案素材 → 100%", () => {
    const assets = [
      { productId: "P1", kind: "image", status: "已生成", isPrimary: true },
      { productId: "P1", kind: "copy", status: "已生成" },
    ];
    const r = computeListingCompleteness(makeDb(baseProduct, assets), "P1");
    expect(r.completeness).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it("缺主图 / 卖点会被列入 missing", () => {
    const p = {
      ...baseProduct,
      sellingPoints: "待补充",
      imageStatus: "未生成",
      copyStatus: "未生成",
    };
    const r = computeListingCompleteness(makeDb(p, []), "P1");
    expect(r.completeness).toBeLessThan(100);
    expect(r.missing).toContain("核心卖点");
    expect(r.missing).toContain("主图设置");
  });

  it("库存为 0 标记 blocked", () => {
    const p = { ...baseProduct, stock: 0 };
    const r = computeListingCompleteness(makeDb(p, []), "P1");
    expect(r.blocked).toBe(true);
  });
});
