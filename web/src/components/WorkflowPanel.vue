<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, onUnmounted, ref } from "vue";
import { api, type ModelImage, type Workflow } from "../api";

const props = defineProps<{ productId: string }>();
// 工作流数据变化(尤其节点生成完成)时通知父级刷新「生成素材/派生状态」
const emit = defineEmits<{ (e: "changed"): void }>();

const workflows = ref<Workflow[]>([]);
const loading = ref(true);
let lastSig = "";
const creating = ref(false);
const platform = ref("抖音");
const PLATFORMS = ["抖音", "小红书", "淘宝"];

let pollTimer: ReturnType<typeof setInterval> | undefined;

function anyRunning() {
  return workflows.value.some((w) => w.nodes.some((n) => n.status === "执行中"));
}

// silent=true 时不显示骨架(轮询刷新用)。生成在后台异步进行,故有节点执行中时自动轮询。
async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    workflows.value = await api.listWorkflows(props.productId);
    // 节点状态有变化 → 通知父级刷新生成素材(尤其生成完成时)
    const sig = workflows.value.map((w) => w.nodes.map((n) => n.status).join()).join("|");
    if (sig !== lastSig) {
      lastSig = sig;
      emit("changed");
    }
  } catch (e) {
    if (!silent) ElMessage.error((e as Error).message);
  } finally {
    loading.value = false;
  }
  if (anyRunning() && !pollTimer) {
    pollTimer = setInterval(() => load(true), 4000);
  } else if (!anyRunning() && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}
onMounted(() => load());
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

async function create() {
  creating.value = true;
  try {
    await api.createWorkflow(props.productId, platform.value);
    ElMessage.success(`已创建「${platform.value}」工作流`);
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    creating.value = false;
  }
}

// 模特图选择(换装生图前)
const modelDialog = ref(false);
const models = ref<ModelImage[]>([]);
const selectedModel = ref("");
const pending = ref<{ wfId: string; nodeId: string } | null>(null);

function modelSrc(u?: string) {
  return !u ? "" : u.startsWith("http") ? u : `/${u}`;
}

// 图片(换装)节点执行前先选模特图;其余动作直接执行。
async function runAction(wfId: string, nodeId: string, action: string, kind?: string) {
  if (action === "execute" && kind === "image") {
    pending.value = { wfId, nodeId };
    selectedModel.value = "";
    try {
      models.value = await api.listModelImages();
    } catch {
      models.value = [];
    }
    modelDialog.value = true;
    return;
  }
  await doAct(wfId, nodeId, action);
}

async function doAct(wfId: string, nodeId: string, action: string, modelImageId?: string) {
  try {
    await api.workflowAction(wfId, nodeId, action, modelImageId);
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function confirmModel() {
  if (!selectedModel.value) {
    ElMessage.warning("请选择一张模特图");
    return;
  }
  const p = pending.value;
  if (!p) return;
  modelDialog.value = false;
  await doAct(p.wfId, p.nodeId, "execute", selectedModel.value);
}

const COLOR: Record<string, string> = {
  未开始: "#cbd5e1",
  可执行: "#2563eb",
  执行中: "#0f9f8f",
  待确认: "#e6a23c",
  已成功: "#138a54",
  失败: "#c2413b",
  已跳过: "#94a3b8",
};
function color(s: string) {
  return COLOR[s] || "#cbd5e1";
}

type Act = { action: string; label: string; type: string };
function primaryAction(status: string): Act | null {
  if (status === "可执行") return { action: "execute", label: "执行", type: "primary" };
  if (status === "待确认") return { action: "confirm", label: "确认", type: "primary" };
  if (status === "失败") return { action: "retry", label: "重试", type: "warning" };
  return null;
}
function canSkip(status: string) {
  return !["已成功", "已跳过", "未开始", "执行中"].includes(status);
}
function wfTagType(status?: string) {
  if (status === "已完成") return "success";
  if (status === "失败") return "danger";
  if (status === "等待确认") return "warning";
  return "info";
}
</script>

<template>
  <div class="wf">
    <div class="wf-head">
      <h3>平台工作流</h3>
      <div class="wf-create">
        <el-select v-model="platform" size="small" style="width: 100px">
          <el-option v-for="p in PLATFORMS" :key="p" :label="p" :value="p" />
        </el-select>
        <el-button size="small" type="primary" :loading="creating" @click="create">＋ 创建链路</el-button>
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="3" animated />
    <el-empty v-else-if="!workflows.length" description="还没有平台工作流,选平台创建一条链路" :image-size="60" />

    <div v-else>
      <el-card v-for="wf in workflows" :key="wf.id" shadow="never" class="wf-card">
        <div class="wf-card-head">
          <strong>{{ wf.platform }}链路</strong>
          <el-tag size="small" :type="wfTagType(wf.status)">{{ wf.status }}</el-tag>
          <el-progress :percentage="wf.progress" :stroke-width="10" class="wf-progress" />
        </div>
        <ul class="nodes">
          <li
            v-for="node in wf.nodes"
            :key="node.id"
            class="node"
            :class="{ cur: node.id === wf.currentNodeId }"
          >
            <span class="dot" :style="{ background: color(node.status) }" />
            <span class="node-label">{{ node.label }}</span>
            <el-tag
              size="small"
              effect="plain"
              :style="{ color: color(node.status), borderColor: color(node.status) }"
            >{{ node.status }}</el-tag>
            <span v-if="node.error" class="node-err">{{ node.error }}</span>
            <span v-if="node.status === '执行中'" class="node-running">
              <el-icon class="is-loading"><Loading /></el-icon>生成中…
            </span>
            <span class="node-actions">
              <el-button
                v-if="primaryAction(node.status)"
                size="small"
                :type="primaryAction(node.status)!.type"
                @click="runAction(wf.id, node.id, primaryAction(node.status)!.action, node.kind)"
              >{{ primaryAction(node.status)!.label }}</el-button>
              <el-button
                v-if="canSkip(node.status)"
                size="small"
                text
                @click="doAct(wf.id, node.id, 'skip')"
              >跳过</el-button>
            </span>
          </li>
        </ul>
      </el-card>
    </div>

    <el-dialog v-model="modelDialog" title="选择模特图(换装)" width="560px">
      <el-empty
        v-if="!models.length"
        description="模特图库还没有图,请先到「模特图库」上传"
        :image-size="70"
      />
      <div v-else class="model-grid">
        <div
          v-for="m in models"
          :key="m.id"
          class="model-cell"
          :class="{ sel: selectedModel === m.id }"
          @click="selectedModel = m.id"
        >
          <el-image :src="modelSrc(m.mediaUrl)" fit="cover" style="width: 120px; height: 120px" />
        </div>
      </div>
      <template #footer>
        <el-button @click="modelDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!selectedModel" @click="confirmModel">用它换装生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.wf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 24px 0 8px;
}
.wf-create {
  display: flex;
  gap: 8px;
}
.wf-card {
  margin-bottom: 12px;
}
.wf-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wf-progress {
  flex: 1;
  margin-left: 8px;
}
.nodes {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}
.node {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-bottom: 1px solid #f5f5f5;
}
.node.cur {
  background: #f0f7ff;
  border-radius: 6px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}
.node-label {
  min-width: 130px;
  font-size: 14px;
}
.node-err {
  color: #c2413b;
  font-size: 12px;
}
.node-running {
  color: #0f9f8f;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.node-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.model-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.model-cell {
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  line-height: 0;
}
.model-cell.sel {
  border-color: #2563eb;
}
</style>
