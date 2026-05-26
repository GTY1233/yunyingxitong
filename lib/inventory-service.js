function getInventoryLevel(product) {
  const stock = Number(product?.stock) || 0;
  const warning = Number(product?.warningStock) || 0;
  if (stock === 0) return "售罄";
  if (stock <= warning) return "库存预警";
  return "库存充足";
}

function checkInventory(product, action = "publish", options = {}) {
  if (!product) return { blocked: true, level: "售罄", reason: "商品不存在" };
  const stock = Number(product.stock) || 0;
  const warning = Number(product.warningStock) || 0;
  const allowLowStock = options.allowLowStock === true;

  if (stock === 0) {
    return {
      blocked: true,
      level: "售罄",
      reason: action === "listing" ? "库存为 0，无法上架" : "库存为 0，无法发布",
    };
  }

  if (stock <= warning && !allowLowStock) {
    return {
      blocked: options.blockOnLowStock === true,
      warn: true,
      level: "库存预警",
      reason: `库存 ${stock} 低于预警 ${warning}，${action === "listing" ? "上架" : "发布"}前请确认`,
    };
  }

  return { blocked: false, level: getInventoryLevel(product) };
}

function deriveProductStatus(product) {
  if (product.stock === 0) return "已暂停";
  if (product.stock <= product.warningStock) return "库存预警";
  if (product.status === "已暂停" || product.status === "库存预警") return "待生成";
  return product.status;
}

function pauseProductOperations(db, product) {
  product.status = ["已上架", "已发布"].includes(product.status) ? product.status : "已暂停";
  product.publishStatus = "已暂停";
  product.listingStatus = product.listingStatus === "已上架" ? product.listingStatus : "库存拦截";

  (db.publishTasks || [])
    .filter((task) => task.productId === product.id && ["待发布", "发布中", "失败"].includes(task.status))
    .forEach((task) => {
      task.status = "已暂停";
      task.time = "库存恢复后";
      task.failureReason = task.failureReason || "库存售罄，任务已暂停";
    });

  (db.listingTasks || [])
    .filter((task) => task.productId === product.id && ["草稿中", "待补充"].includes(task.status))
    .forEach((task) => {
      task.status = "库存拦截";
    });
}

function resumeProductOperations(db, product) {
  if (product.stock === 0) return;

  if (product.publishStatus === "已暂停") product.publishStatus = "待发布";
  if (product.listingStatus === "库存拦截") product.listingStatus = "草稿中";

  if (product.stock <= product.warningStock) {
    if (!["已上架", "已发布", "生成中"].includes(product.status)) {
      product.status = "库存预警";
    }
  } else if (["库存预警", "已暂停"].includes(product.status)) {
    product.status = deriveProductStatus({ ...product, status: "待生成" });
  }

  (db.publishTasks || [])
    .filter((task) => task.productId === product.id && task.status === "已暂停")
    .forEach((task) => {
      task.status = "待发布";
      task.time = "库存恢复后待排期";
      task.failureReason = "";
    });

  (db.listingTasks || [])
    .filter((task) => task.productId === product.id && task.status === "库存拦截")
    .forEach((task) => {
      task.status = task.completeness >= 80 ? "草稿中" : "待补充";
    });
}

function applyStockSideEffects(db, product, previousStock) {
  const prev = Number.isFinite(Number(previousStock)) ? Number(previousStock) : product.stock;
  if (product.stock === 0) {
    pauseProductOperations(db, product);
    return;
  }
  resumeProductOperations(db, product);
  if (prev === 0 && product.stock > 0) {
    // resumeProductOperations already handles task restore
  }
}

function updateProductInventory(db, productId, patch, helpers) {
  const product = (db.products || []).find((item) => item.id === productId);
  if (!product) return { error: "Product not found" };

  const previousStock = product.stock;
  if (patch.stock !== undefined) {
    product.stock = Math.max(0, Number.isFinite(Number(patch.stock)) ? Number(patch.stock) : product.stock);
  }
  if (patch.warningStock !== undefined) {
    product.warningStock = Math.max(0, Number.isFinite(Number(patch.warningStock)) ? Number(patch.warningStock) : product.warningStock);
  }
  product.updatedAt = helpers?.formatNow?.() || "刚刚";
  applyStockSideEffects(db, product, previousStock);

  const level = getInventoryLevel(product);
  helpers?.addLog?.(
    db,
    product.id,
    `[库存] 更新为 ${product.stock}（预警 ${product.warningStock} / ${level}）`,
    "inventory"
  );

  return { product, level, resumed: previousStock === 0 && product.stock > 0 };
}

function batchImportInventory(db, rows, helpers) {
  const updated = [];
  const skipped = [];

  (rows || []).forEach((row) => {
    const code = String(row.code || row.sku || "").trim();
    const productId = String(row.productId || "").trim();
    const product =
      (productId && (db.products || []).find((item) => item.id === productId)) ||
      (code && (db.products || []).find((item) => item.code === code));

    if (!product) {
      skipped.push({ row, reason: "未找到商品" });
      return;
    }

    const result = updateProductInventory(
      db,
      product.id,
      {
        stock: row.stock,
        warningStock: row.warningStock,
      },
      helpers
    );
    updated.push({ productId: product.id, name: product.name, stock: product.stock, level: result.level });
  });

  return { updated, skipped, count: updated.length };
}

function parseInventoryCsv(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [code, stock, warningStock] = line.split(/[,，\t]/).map((item) => item.trim());
      return {
        code,
        stock: Number(stock),
        warningStock: warningStock ? Number(warningStock) : undefined,
      };
    })
    .filter((row) => row.code && Number.isFinite(row.stock));
}

module.exports = {
  getInventoryLevel,
  checkInventory,
  deriveProductStatus,
  applyStockSideEffects,
  pauseProductOperations,
  resumeProductOperations,
  updateProductInventory,
  batchImportInventory,
  parseInventoryCsv,
};
