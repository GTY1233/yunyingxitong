import { describe, expect, it } from "vitest";
import { buildNodeRows, listTemplates } from "../lib/workflow/chains.js";
import {
  applyAction,
  computeWorkflowStatus,
  initialActiveStatus,
  initializeNodes,
  progress,
} from "../lib/workflow/machine.js";

// 给节点行补上 id(模拟入库后),便于 applyAction 按 id 定位。
function withIds(rows) {
  return rows.map((r, i) => ({ ...r, id: `n${i}` }));
}

describe("chains", () => {
  it("三平台链长度正确", () => {
    const t = listTemplates();
    expect(t.find((x) => x.platform === "抖音").stepCount).toBe(12);
    expect(t.find((x) => x.platform === "小红书").stepCount).toBe(9);
    expect(t.find((x) => x.platform === "淘宝").stepCount).toBe(6);
  });
});

describe("initialActiveStatus", () => {
  it("副作用类型→可执行,人工/观测→待确认", () => {
    expect(initialActiveStatus("generate")).toBe("可执行");
    expect(initialActiveStatus("listing")).toBe("可执行");
    expect(initialActiveStatus("publish")).toBe("可执行");
    expect(initialActiveStatus("manual")).toBe("待确认");
    expect(initialActiveStatus("observe")).toBe("待确认");
  });
});

describe("initializeNodes", () => {
  it("商品资料默认完成,激活下一个(图片生成=可执行)", () => {
    const nodes = initializeNodes(withIds(buildNodeRows("淘宝")));
    expect(nodes[0].nodeKey).toBe("product_info");
    expect(nodes[0].status).toBe("已成功");
    expect(nodes[1].nodeKey).toBe("generate_image");
    expect(nodes[1].status).toBe("可执行");
    expect(nodes[2].status).toBe("未开始");
  });
});

describe("applyAction 状态流转", () => {
  function init(platform) {
    return initializeNodes(withIds(buildNodeRows(platform)));
  }

  it("execute 可执行节点→已成功,并激活下一节点", () => {
    const nodes = init("淘宝");
    const after = applyAction(nodes, { type: "execute", nodeId: "n1" });
    expect(after[1].status).toBe("已成功");
    expect(after[2].status).toBe("可执行"); // generate_copy 被激活
  });

  it("execute 非可执行节点抛错", () => {
    const nodes = init("淘宝");
    expect(() => applyAction(nodes, { type: "execute", nodeId: "n3" })).toThrow();
  });

  it("confirm 待确认节点(预览确认)→已成功", () => {
    let nodes = init("淘宝");
    nodes = applyAction(nodes, { type: "execute", nodeId: "n1" }); // 图
    nodes = applyAction(nodes, { type: "execute", nodeId: "n2" }); // 文案 → 激活 wait_confirm(manual)
    expect(nodes[3].status).toBe("待确认");
    nodes = applyAction(nodes, { type: "confirm", nodeId: "n3" });
    expect(nodes[3].status).toBe("已成功");
    expect(nodes[4].status).toBe("可执行"); // create_listing
  });

  it("skip 跳过并激活下一节点", () => {
    const nodes = init("淘宝");
    const after = applyAction(nodes, { type: "skip", nodeId: "n1" });
    expect(after[1].status).toBe("已跳过");
    expect(after[2].status).toBe("可执行");
  });

  it("retry 仅对失败节点生效,恢复为可执行", () => {
    let nodes = init("淘宝");
    nodes = applyAction(nodes, { type: "fail", nodeId: "n1", error: "超时" });
    expect(nodes[1].status).toBe("失败");
    expect(computeWorkflowStatus(nodes)).toBe("失败");
    nodes = applyAction(nodes, { type: "retry", nodeId: "n1" });
    expect(nodes[1].status).toBe("可执行");
    expect(nodes[1].error).toBe("");
  });

  it("start 可执行→执行中,complete 执行中→已成功并激活下一节点", () => {
    const nodes = init("淘宝");
    let after = applyAction(nodes, { type: "start", nodeId: "n1" });
    expect(after[1].status).toBe("执行中");
    after = applyAction(after, { type: "complete", nodeId: "n1" });
    expect(after[1].status).toBe("已成功");
    expect(after[2].status).toBe("可执行");
  });

  it("complete 非执行中节点抛错", () => {
    const nodes = init("淘宝");
    expect(() => applyAction(nodes, { type: "complete", nodeId: "n1" })).toThrow();
  });

  it("淘宝链全程推进到已完成", () => {
    let nodes = init("淘宝"); // n0已成功, n1可执行
    nodes = applyAction(nodes, { type: "execute", nodeId: "n1" }); // 图
    nodes = applyAction(nodes, { type: "execute", nodeId: "n2" }); // 文案
    nodes = applyAction(nodes, { type: "confirm", nodeId: "n3" }); // 预览确认
    nodes = applyAction(nodes, { type: "execute", nodeId: "n4" }); // 上架
    nodes = applyAction(nodes, { type: "confirm", nodeId: "n5" }); // 数据回流(observe)
    expect(progress(nodes)).toBe(100);
    expect(computeWorkflowStatus(nodes)).toBe("已完成");
  });
});
