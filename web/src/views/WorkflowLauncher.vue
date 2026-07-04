<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  type BatchLaunchResult,
  type Product,
  type Workflow,
  type WorkflowTemplate,
  api,
} from "../api";

const router = useRouter();

const products = ref<Product[]>([]);
const templates = ref<WorkflowTemplate[]>([]);
const loading = ref(true);
const error = ref("");

const productId = ref("");
const selected = ref<string[]>([]);
const autoRun = ref(true);
const launching = ref(false);
const results = ref<BatchLaunchResult[]>([]);

// 选中商品已存在的工作流(用于标注「进行中」,避免重复建链)
const existing = ref<Workflow[]>([]);
const existingLoading = ref(false);

onMounted(async () => {
  try {
    [products.value, templates.value] = await Promise.all([
      api.listProducts(),
      api.listWorkflowTemplates(),
    ]);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});

const currentProduct = computed(() => products.value.find((p) => p.id === productId.value));

// 该平台是否已有进行中链(已完成的不算)
function activeWorkflow(platform: string) {
  return existing.value.find((w) => w.platform === platform && w.status !== "已完成");
}

watch(productId, async (id) => {
  results.value = [];
  selected.value = [];
  existing.value = [];
  if (!id) return;
  existingLoading.value = true;
  try {
    existing.value = await api.listWorkflows(id);
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    existingLoading.value = false;
  }
});

function toggle(platform: string) {
  if (activeWorkflow(platform)) return; // 已进行中,不可重复选
  const i = selected.value.indexOf(platform);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(platform);
}

// 简易完整度提示(给用户启动前一个心理预期;真正门槛在上架节点强校验)
const readiness = computed(() => {
  const p = currentProduct.value;
  if (!p) return [];
  return [
    { label: "商品名称", ok: !!p.name },
    { label: "价格", ok: (p.priceCents || 0) > 0 },
    { label: "库存", ok: (p.stock || 0) > 0 },
    { label: "卖点", ok: !!p.sellingPoints },
  ];
});

async function launch() {
  if (!productId.value) {
    ElMessage.warning("请先选择商品");
    return;
  }
  if (!selected.value.length) {
    ElMessage.warning("请至少选择一个平台");
    return;
  }
  launching.value = true;
  results.value = [];
  try {
    const r = await api.batchLaunchWorkflows(productId.value, selected.value, autoRun.value);
    results.value = r.results;
    const okCount = r.results.filter((x) => x.ok).length;
    if (okCount) ElMessage.success(`已启动 ${okCount} 条工作流`);
    existing.value = await api.listWorkflows(productId.value);
    selected.value = [];
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    launching.value = false;
  }
}

function goDetail() {
  if (productId.value) router.push(`/products/${productId.value}`);
}
</script>

<template>
  <h2>工作流启动</h2>
  <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
    选一个商品 + 勾选要铺的平台,一键为每个平台建立运营链路(生图/生文/生视频 → 预览 → 上架 → 发布)。
    建好后到「商品 · 工作流」逐节点推进。
  </el-alert>

  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" />
  <el-skeleton v-if="loading" :rows="5" animated />

  <template v-else>
    <el-card shadow="never" style="margin-bottom: 16px">
      <div class="step-title">① 选择商品</div>
      <el-select
        v-model="productId"
        filterable
        placeholder="搜索 / 选择商品"
        style="width: 100%; max-width: 420px"
      >
        <el-option
          v-for="p in products"
          :key="p.id"
          :value="p.id"
          :label="`${p.displayCode || ''} ${p.name}`"
        />
      </el-select>

      <div v-if="currentProduct" class="readiness">
        <span style="color: var(--el-text-color-secondary); margin-right: 8px">资料完整度:</span>
        <el-tag
          v-for="r in readiness"
          :key="r.label"
          size="small"
          :type="r.ok ? 'success' : 'info'"
          style="margin-right: 6px"
        >
          {{ r.ok ? "✓" : "—" }} {{ r.label }}
        </el-tag>
        <el-button link type="primary" size="small" @click="goDetail">查看商品详情</el-button>
      </div>
    </el-card>

    <el-card v-if="productId" shadow="never" style="margin-bottom: 16px">
      <div class="step-title">② 选择平台(可多选)</div>
      <el-checkbox v-model="autoRun" style="margin-bottom: 12px">
        创建后自动跑(AI 生成自动执行,停在审核点等你确认)
      </el-checkbox>
      <div v-loading="existingLoading" class="platform-grid">
        <div
          v-for="t in templates"
          :key="t.platform"
          class="platform-card"
          :class="{
            picked: selected.includes(t.platform),
            disabled: !!activeWorkflow(t.platform),
          }"
          @click="toggle(t.platform)"
        >
          <div class="platform-head">
            <el-checkbox
              :model-value="selected.includes(t.platform)"
              :disabled="!!activeWorkflow(t.platform)"
              @click.stop="toggle(t.platform)"
            />
            <strong>{{ t.platform }}</strong>
            <el-tag size="small" type="info">{{ t.stepCount }} 步</el-tag>
            <el-tag v-if="t.runMode === 'demo'" size="small" type="info">演示</el-tag>
            <el-tag v-else-if="t.runMode === 'manual'" size="small" type="warning">人工</el-tag>
            <el-tag v-else-if="t.runMode === 'real'" size="small" type="success">真实</el-tag>
            <el-tag v-if="activeWorkflow(t.platform)" size="small" type="warning">进行中</el-tag>
          </div>
          <div class="platform-steps">{{ t.steps.join(" → ") }}</div>
        </div>
      </div>

      <div style="margin-top: 16px">
        <el-button
          type="primary"
          :loading="launching"
          :disabled="!selected.length"
          @click="launch"
        >
          启动 {{ selected.length || "" }} 条工作流
        </el-button>
      </div>
    </el-card>

    <el-card v-if="results.length" shadow="never">
      <div class="step-title">③ 启动结果</div>
      <ul class="result-list">
        <li v-for="r in results" :key="r.platform">
          <el-tag size="small" :type="r.ok ? 'success' : 'danger'">{{ r.platform }}</el-tag>
          <span v-if="r.ok" style="margin-left: 8px">{{ autoRun ? "已建立并自动开跑" : "已建立工作流" }}</span>
          <span v-else style="margin-left: 8px; color: var(--el-color-danger)">{{ r.error }}</span>
        </li>
      </ul>
      <el-button type="primary" plain @click="goDetail">去「商品 · 工作流」推进</el-button>
    </el-card>
  </template>
</template>

<style scoped>
.step-title {
  font-weight: 600;
  margin-bottom: 12px;
}
.readiness {
  margin-top: 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.platform-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.platform-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.platform-card:hover {
  border-color: var(--el-color-primary);
}
.platform-card.picked {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.platform-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.platform-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.platform-steps {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.result-list {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
}
.result-list li {
  padding: 6px 0;
}
</style>
