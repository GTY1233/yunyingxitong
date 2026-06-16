<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, type DashboardStats } from "../api";

const router = useRouter();
const stats = ref<DashboardStats | null>(null);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    stats.value = await api.getStats();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <h2>今日工作台</h2>
  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" />
  <el-skeleton v-if="loading" :rows="4" animated />

  <template v-else-if="stats">
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card shadow="hover" style="cursor: pointer" @click="router.push('/products')">
          <el-statistic title="商品总数" :value="stats.products" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="待发布" :value="stats.productsByStatus['待发布'] || 0" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="已发布" :value="stats.productsByStatus['已发布'] || 0" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" :class="{ warn: stats.lowStock > 0 }">
          <el-statistic title="库存预警" :value="stats.lowStock" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="6">
        <el-card shadow="hover" style="cursor: pointer" @click="router.push('/accounts')">
          <el-statistic title="账号(矩阵)" :value="stats.accounts" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover"><el-statistic title="素材总数" :value="stats.assets" /></el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <div class="mini">
            素材构成：图 {{ stats.assetsByKind.image || 0 }} · 视频 {{ stats.assetsByKind.video || 0 }} · 文案
            {{ stats.assetsByKind.copy || 0 }}
          </div>
          <div class="mini">
            账号角色：授权号 {{ stats.accountsByRole.authorized || 0 }} · 达人号
            {{ stats.accountsByRole.creator || 0 }}
          </div>
        </el-card>
      </el-col>
    </el-row>
  </template>
</template>

<style scoped>
.warn {
  border-color: #e6a23c;
}
.mini {
  color: #64748b;
  font-size: 13px;
  line-height: 2;
}
</style>
