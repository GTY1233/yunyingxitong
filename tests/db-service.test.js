import { describe, expect, it } from "vitest";
import { DATA_KEYS, emptyDb, normalizeDb } from "../lib/db-service.js";

describe("emptyDb", () => {
  it("包含所有数据键且均为数组", () => {
    const db = emptyDb();
    for (const k of DATA_KEYS) {
      expect(Array.isArray(db[k])).toBe(true);
    }
  });
});

describe("normalizeDb 历史状态迁移", () => {
  it("把 legacy 资产状态映射为新枚举", () => {
    const db = normalizeDb({
      assets: [
        { id: "A1", status: "待审核", usage: "素材库" },
        { id: "A2", status: "审核驳回" },
      ],
    });
    expect(db.assets[0].status).toBe("已生成");
    expect(db.assets[0].usage).toBe("成品库");
    expect(db.assets[1].status).toBe("生成失败");
  });

  it("商品 待审核 → 待发布,并迁移子状态字段", () => {
    const db = normalizeDb({
      products: [{ id: "P1", status: "待审核", imageStatus: "生成成功" }],
    });
    expect(db.products[0].status).toBe("待发布");
    expect(db.products[0].imageStatus).toBe("已生成");
  });

  it("缺失键补齐为空数组,非数组输入被规整", () => {
    const db = normalizeDb({ products: "garbage" });
    expect(Array.isArray(db.products)).toBe(true);
    expect(db.products.length).toBe(0);
  });
});
