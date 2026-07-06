<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, ref } from "vue";
import { type Account, api } from "../api";

const accounts = ref<Account[]>([]);
const loading = ref(true);
const error = ref("");

async function load() {
  try {
    accounts.value = await api.listAccounts();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const ROLE: Record<string, { label: string; type: string }> = {
  main_shop: { label: "主店", type: "danger" },
  authorized: { label: "授权号", type: "warning" },
  creator: { label: "达人号", type: "success" },
};
function role(r?: string) {
  return ROLE[r || ""] || { label: r || "—", type: "info" };
}

async function editHandle(row: Account) {
  let val: string;
  try {
    const { value } = await ElMessageBox.prompt(
      "social-auto-upload 登录该号时用的 --account 名",
      `设置发布名：${row.name || row.id}`,
      {
        inputValue: row.publishHandle || "",
        inputPlaceholder: "如 douyin_main_01",
        confirmButtonText: "保存",
        cancelButtonText: "取消",
      },
    );
    val = (value || "").trim();
  } catch {
    return; // 取消
  }
  try {
    await api.setAccountPublishHandle(row.id, val);
    ElMessage.success("发布名已更新");
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
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
    <el-table-column width="200">
      <template #header>
        发布名(自动发布)
        <el-tooltip
          content="social-auto-upload 登录该号时用的 --account 名；配好才能自动发布到此号"
          placement="top"
        >
          <el-icon style="vertical-align: middle"><QuestionFilled /></el-icon>
        </el-tooltip>
      </template>
      <template #default="{ row }">
        <span v-if="row.publishHandle">{{ row.publishHandle }}</span>
        <span v-else style="color: #94a3b8">—</span>
        <el-button link size="small" type="primary" @click="editHandle(row)">编辑</el-button>
      </template>
    </el-table-column>
    <el-table-column label="演示号" width="80">
      <template #default="{ row }">
        <el-tag v-if="row.isDemo" size="small" type="info">演示</el-tag>
      </template>
    </el-table-column>
  </el-table>
</template>
