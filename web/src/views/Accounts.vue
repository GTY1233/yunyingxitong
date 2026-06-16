<script setup lang="ts">
import { onMounted, ref } from "vue";
import { type Account, api } from "../api";

const accounts = ref<Account[]>([]);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    accounts.value = await api.listAccounts();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});

const ROLE: Record<string, { label: string; type: string }> = {
  main_shop: { label: "主店", type: "danger" },
  authorized: { label: "授权号", type: "warning" },
  creator: { label: "达人号", type: "success" },
};
function role(r?: string) {
  return ROLE[r || ""] || { label: r || "—", type: "info" };
}
</script>

<template>
  <h2>平台账号(矩阵)</h2>
  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" />
  <el-skeleton v-if="loading" :rows="5" animated />
  <el-table v-else :data="accounts">
    <el-table-column prop="name" label="账号" min-width="150" />
    <el-table-column prop="platform" label="平台" width="100" />
    <el-table-column prop="type" label="类型" width="120" />
    <el-table-column label="矩阵角色" width="120">
      <template #default="{ row }">
        <el-tag :type="role(row.role).type" size="small">{{ role(row.role).label }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="auth" label="授权" width="150" />
    <el-table-column prop="rule" label="发布规则" min-width="140" />
    <el-table-column label="演示号" width="80">
      <template #default="{ row }">
        <el-tag v-if="row.isDemo" size="small" type="info">演示</el-tag>
      </template>
    </el-table-column>
  </el-table>
</template>
