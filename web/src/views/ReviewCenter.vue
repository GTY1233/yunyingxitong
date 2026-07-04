<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { type ReviewItem, api } from "../api";

const router = useRouter();

const items = ref<ReviewItem[]>([]);
const loading = ref(true);
const error = ref("");
// 单条操作 loading(key = nodeId + action)
const acting = ref<Record<string, boolean>>({});

async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    const q = await api.getReviewQueue();
    items.value = q.items;
    error.value = "";
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(() => load());

const pendingItems = computed(() => items.value.filter((i) => i.status === "待确认"));
const failedItems = computed(() => items.value.filter((i) => i.status === "失败"));

function fmtTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const ACTION_LABEL: Record<string, string> = {
  confirm: "已通过",
  retry: "已重试",
  skip: "已跳过",
};

async function act(item: ReviewItem, action: "confirm" | "retry" | "skip") {
  const key = `${item.nodeId}:${action}`;
  acting.value[key] = true;
  try {
    await api.workflowAction(item.workflowId, item.nodeId, action);
    const suffix = item.autoMode && action !== "skip" ? ",流水线自动续跑" : "";
    ElMessage.success(`${ACTION_LABEL[action]}「${item.nodeLabel}」${suffix}`);
    await load(true);
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    acting.value[key] = false;
  }
}

function goProduct(item: ReviewItem) {
  router.push(`/products/${item.productId}`);
}
</script>

<template>
  <h2>审核中心</h2>
  <p class="sub">
    自动流水线跑到审核点或出错时会停在这里等你。通过 / 重试后,自动流水线会接着往下跑,不用你盯着。
  </p>

  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" />
  <el-skeleton v-else-if="loading" :rows="5" animated />

  <template v-else>
    <el-empty
      v-if="!pendingItems.length && !failedItems.length"
      description="没有等你处理的事项,自动流水线运转中 ✨"
    />

    <section v-if="pendingItems.length" class="section">
      <h3>待你审核({{ pendingItems.length }})</h3>
      <el-card v-for="item in pendingItems" :key="item.nodeId" shadow="never" class="item-card">
        <div class="item-row">
          <div class="item-main">
            <div class="item-title">
              <span class="product-name">{{ item.productName }}</span>
              <el-tag size="small" effect="plain">{{ item.displayCode || "未编号" }}</el-tag>
              <el-tag size="small">{{ item.platform }}</el-tag>
              <strong class="node-label">{{ item.nodeLabel }}</strong>
              <el-tag v-if="item.autoMode" size="small" type="success">自动</el-tag>
            </div>
            <div v-if="item.hint" class="hint">{{ item.hint }}</div>
            <div class="time">{{ fmtTime(item.updatedAt) }}</div>
          </div>
          <div class="item-actions">
            <el-button
              type="primary"
              size="small"
              :loading="acting[`${item.nodeId}:confirm`]"
              @click="act(item, 'confirm')"
            >通过</el-button>
            <el-button
              link
              size="small"
              :loading="acting[`${item.nodeId}:skip`]"
              @click="act(item, 'skip')"
            >跳过</el-button>
            <el-button link type="primary" size="small" @click="goProduct(item)">查看商品</el-button>
          </div>
        </div>
      </el-card>
    </section>

    <section v-if="failedItems.length" class="section">
      <h3>需要处理({{ failedItems.length }})</h3>
      <el-card v-for="item in failedItems" :key="item.nodeId" shadow="never" class="item-card">
        <div class="item-row">
          <div class="item-main">
            <div class="item-title">
              <span class="product-name">{{ item.productName }}</span>
              <el-tag size="small" effect="plain">{{ item.displayCode || "未编号" }}</el-tag>
              <el-tag size="small">{{ item.platform }}</el-tag>
              <strong class="node-label">{{ item.nodeLabel }}</strong>
              <el-tag v-if="item.autoMode" size="small" type="success">自动</el-tag>
            </div>
            <div v-if="item.error" class="err">{{ item.error }}</div>
            <div v-if="item.hint" class="hint">{{ item.hint }}</div>
            <div class="time">{{ fmtTime(item.updatedAt) }}</div>
          </div>
          <div class="item-actions">
            <el-button
              type="warning"
              size="small"
              :loading="acting[`${item.nodeId}:retry`]"
              @click="act(item, 'retry')"
            >重试</el-button>
            <el-button
              link
              size="small"
              :loading="acting[`${item.nodeId}:skip`]"
              @click="act(item, 'skip')"
            >跳过</el-button>
            <el-button link type="primary" size="small" @click="goProduct(item)">查看商品</el-button>
          </div>
        </div>
      </el-card>
    </section>
  </template>
</template>

<style scoped>
.sub {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: -4px 0 16px;
}
.section {
  margin-bottom: 24px;
}
.section h3 {
  margin: 0 0 10px;
}
.item-card {
  margin-bottom: 10px;
}
.item-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.item-main {
  min-width: 0;
}
.item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.product-name {
  font-size: 14px;
}
.node-label {
  font-size: 14px;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 6px;
}
.err {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-top: 6px;
}
.time {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  margin-top: 6px;
}
.item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
</style>
