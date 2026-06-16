<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, ref } from "vue";
import { api, type Workflow } from "../api";

const props = defineProps<{ productId: string }>();

const workflows = ref<Workflow[]>([]);
const loading = ref(true);
const creating = ref(false);
const platform = ref("抖音");
const PLATFORMS = ["抖音", "小红书", "淘宝"];

async function load() {
  loading.value = true;
  try {
    workflows.value = await api.listWorkflows(props.productId);
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

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

async function act(workflowId: string, nodeId: string, action: string) {
  try {
    await api.workflowAction(workflowId, nodeId, action);
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
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
  return !["已成功", "已跳过", "未开始"].includes(status);
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
            <span class="node-actions">
              <el-button
                v-if="primaryAction(node.status)"
                size="small"
                :type="primaryAction(node.status)!.type"
                @click="act(wf.id, node.id, primaryAction(node.status)!.action)"
              >{{ primaryAction(node.status)!.label }}</el-button>
              <el-button
                v-if="canSkip(node.status)"
                size="small"
                text
                @click="act(wf.id, node.id, 'skip')"
              >跳过</el-button>
            </span>
          </li>
        </ul>
      </el-card>
    </div>
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
.node-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
</style>
