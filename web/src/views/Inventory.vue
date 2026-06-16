<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { api, type Product } from "../api";

const products = ref<Product[]>([]);
const loading = ref(true);
const error = ref("");
const onlyWarn = ref(false);
const saving = reactive<Record<string, boolean>>({});

// 每行库存编辑值（id -> stock）
const edits = reactive<Record<string, number>>({});

async function load() {
  loading.value = true;
  try {
    products.value = await api.listProducts();
    for (const p of products.value) {
      edits[p.id] = p.stock ?? 0;
    }
    error.value = "";
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function isWarn(p: Product) {
  return (p.stock ?? 0) <= (p.warningStock ?? 0);
}

const warnCount = computed(() => products.value.filter(isWarn).length);

const shownProducts = computed(() =>
  onlyWarn.value ? products.value.filter(isWarn) : products.value,
);

function rowClassName({ row }: { row: Product }) {
  return isWarn(row) ? "warn-row" : "";
}

function tagType(status?: string) {
  if (status === "已发布") return "success";
  if (status === "待发布") return "warning";
  return "info";
}

async function save(row: Product) {
  const next = edits[row.id];
  if (next == null || next < 0) {
    ElMessage.warning("请填写有效库存");
    return;
  }
  saving[row.id] = true;
  try {
    await api.updateProduct(row.id, { stock: next });
    ElMessage.success("库存已更新");
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    saving[row.id] = false;
  }
}
</script>

<template>
  <div class="head">
    <h2>库存管理</h2>
    <div class="head-right">
      <el-tag :type="warnCount ? 'danger' : 'success'" effect="light">
        预警商品 {{ warnCount }}
      </el-tag>
      <el-switch v-model="onlyWarn" active-text="只看预警" inline-prompt />
    </div>
  </div>

  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" />
  <el-skeleton v-if="loading" :rows="5" animated />
  <el-empty v-else-if="!products.length" description="暂无商品" />
  <el-empty v-else-if="!shownProducts.length" description="没有预警商品" />
  <el-table v-else :data="shownProducts" :row-class-name="rowClassName" border>
    <el-table-column label="编号" width="110">
      <template #default="{ row }">{{ row.displayCode || "—" }}</template>
    </el-table-column>
    <el-table-column prop="name" label="名称" min-width="160" />
    <el-table-column prop="stock" label="当前库存" width="100" align="center" />
    <el-table-column prop="warningStock" label="预警库存" width="100" align="center" />
    <el-table-column label="状态" width="110">
      <template #default="{ row }">
        <el-tag size="small" :type="tagType(row.status)">{{ row.status || "—" }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="260">
      <template #default="{ row }">
        <div class="ops">
          <el-input-number
            v-model="edits[row.id]"
            :min="0"
            :step="1"
            size="small"
            controls-position="right"
            style="width: 130px"
          />
          <el-button
            type="primary"
            size="small"
            :loading="saving[row.id]"
            @click="save(row)"
          >
            保存
          </el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ops {
  display: flex;
  align-items: center;
  gap: 8px;
}
:deep(.warn-row) {
  background: #fef0f0;
}
</style>
