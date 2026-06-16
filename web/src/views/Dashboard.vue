<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, type DashboardStats } from "../api";

const router = useRouter();
const stats = ref<DashboardStats | null>(null);
const loading = ref(true);
const error = ref("");

type WorkbenchLowStock = { id: string; displayCode?: string; name: string; stock?: number; warningStock?: number };
type WorkbenchMissingMedia = { id: string; displayCode?: string; name: string; missing: string[] };
const lowStock = ref<WorkbenchLowStock[]>([]);
const missingMedia = ref<WorkbenchMissingMedia[]>([]);

const missingLabels: Record<string, string> = { image: "图", copy: "文案", video: "视频" };
function missingLabel(m: string) {
  return missingLabels[m] || m;
}

onMounted(async () => {
  try {
    stats.value = await api.getStats();
  } catch (e) {
    error.value = (e as Error).message;
  }
  try {
    const wb = await api.getWorkbench();
    lowStock.value = wb?.lowStock || [];
    missingMedia.value = wb?.missingMedia || [];
  } catch {
    // 待办区加载失败不阻断 KPI 展示
  }
  loading.value = false;
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

    <h3>待办</h3>
    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>库存预警({{ lowStock.length }})</template>
          <el-empty v-if="!lowStock.length" description="无库存预警" :image-size="80" />
          <ul v-else class="todo-list">
            <li v-for="item in lowStock" :key="item.id" class="todo-item">
              <div class="todo-main">
                <span class="todo-name">{{ item.name }}</span>
                <span v-if="item.displayCode" class="todo-code">({{ item.displayCode }})</span>
                <span class="todo-meta">库存 {{ item.stock ?? 0 }} / 预警 {{ item.warningStock ?? 0 }}</span>
              </div>
              <el-button text type="primary" @click="router.push('/products/' + item.id)">去处理</el-button>
            </li>
          </ul>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>缺素材({{ missingMedia.length }})</template>
          <el-empty v-if="!missingMedia.length" description="素材齐全" :image-size="80" />
          <ul v-else class="todo-list">
            <li v-for="item in missingMedia" :key="item.id" class="todo-item">
              <div class="todo-main">
                <span class="todo-name">{{ item.name }}</span>
                <span v-if="item.displayCode" class="todo-code">({{ item.displayCode }})</span>
                <span class="todo-tags">
                  <el-tag
                    v-for="m in item.missing"
                    :key="m"
                    size="small"
                    type="warning"
                    effect="plain"
                  >{{ missingLabel(m) }}</el-tag>
                </span>
              </div>
              <el-button text type="primary" @click="router.push('/products/' + item.id)">去生成</el-button>
            </li>
          </ul>
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
h3 {
  margin: 24px 0 12px;
}
.todo-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}
.todo-item:last-child {
  border-bottom: none;
}
.todo-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.todo-name {
  font-weight: 500;
}
.todo-code {
  color: #94a3b8;
  font-size: 12px;
}
.todo-meta {
  color: #64748b;
  font-size: 13px;
}
.todo-tags {
  display: inline-flex;
  gap: 4px;
}
</style>
