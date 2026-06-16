<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, type Product } from "../api";

const router = useRouter();
const products = ref<Product[]>([]);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    products.value = await api.listProducts();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});

function yuan(cents?: number) {
  return cents == null ? "-" : `¥${(cents / 100).toFixed(2)}`;
}
function open(row: Product) {
  router.push(`/products/${row.id}`);
}
</script>

<template>
  <h2>商品列表</h2>
  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" />
  <el-skeleton v-if="loading" :rows="5" animated />
  <el-empty v-else-if="!products.length" description="暂无商品" />
  <el-table v-else :data="products" style="cursor: pointer" @row-click="open">
    <el-table-column prop="displayCode" label="编号" width="110" />
    <el-table-column prop="name" label="名称" min-width="160" />
    <el-table-column label="价格" width="120">
      <template #default="{ row }">{{ yuan(row.priceCents) }}</template>
    </el-table-column>
    <el-table-column prop="stock" label="库存" width="90" />
    <el-table-column label="状态" width="120">
      <template #default="{ row }">
        <el-tag size="small" :type="row.status === '已发布' ? 'success' : 'info'">{{ row.status }}</el-tag>
      </template>
    </el-table-column>
  </el-table>
</template>
