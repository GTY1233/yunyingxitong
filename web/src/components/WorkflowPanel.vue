<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { type ModelImage, type ReferenceVideo, type Workflow, api } from "../api";

const props = defineProps<{ productId: string }>();
// 工作流数据变化(尤其节点生成完成)时通知父级刷新「生成素材/派生状态」
const emit = defineEmits<{ (e: "changed"): void }>();

const DEFAULT_TRYON_PROMPT =
  "先脱光图一女生的全部衣服和帽子、鞋袜手套，再让图1的女人穿上图2款式的衣服，保持图一角色脸部、发型、姿态角度不变";

const workflows = ref<Workflow[]>([]);
const loading = ref(true);
let lastSig = "";
const creating = ref(false);
const platform = ref("抖音");
const PLATFORMS = ["抖音", "小红书", "淘宝"];

// 每条链路的「自动推进」开关(wfId -> 开/关),从后端 autoMode 同步
const autoOn = reactive<Record<string, boolean>>({});

let pollTimer: ReturnType<typeof setInterval> | undefined;
// 「已进行 mm:ss」计时器用的当前时间(每秒刷新),仅在有执行中节点时才跑,避免空转
const now = ref(Date.now());
let tickTimer: ReturnType<typeof setInterval> | undefined;

// 有节点执行中,或自动模式链路仍在执行中(节点间切换瞬间没有执行中节点,不能停表)
function shouldPoll() {
  return workflows.value.some(
    (w) => w.nodes.some((n) => n.status === "执行中") || (w.autoMode && w.status === "执行中")
  );
}

// 是否存在「执行中」节点(计时器只在此时跑,和 4 秒轮询各自独立)
function hasRunningNode() {
  return workflows.value.some((w) => w.nodes.some((n) => n.status === "执行中"));
}

// 从 updatedAt 到现在的秒数,格式化成 mm:ss(超过 60 分钟就 h:mm:ss)
function fmtElapsed(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}
function elapsedSec(node: { updatedAt?: string }) {
  if (!node.updatedAt) return 0;
  return Math.max(0, Math.floor((now.value - Date.parse(node.updatedAt)) / 1000));
}

async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    workflows.value = await api.listWorkflows(props.productId);
    for (const w of workflows.value) autoOn[w.id] = w.autoMode;
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
  if (shouldPoll() && !pollTimer) {
    pollTimer = setInterval(() => load(true), 4000);
  } else if (!shouldPoll() && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
  // 1 秒 ticker:只在有「执行中」节点时跑,用来推进「已进行 mm:ss」
  if (hasRunningNode() && !tickTimer) {
    now.value = Date.now();
    tickTimer = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  } else if (!hasRunningNode() && tickTimer) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
}

async function onAutoChange(wf: Workflow, val: string | number | boolean) {
  const enable = !!val;
  try {
    await api.setWorkflowAuto(wf.id, enable);
    ElMessage.success(enable ? "已开启自动推进" : "已关闭自动推进");
    await load(true);
  } catch (e) {
    ElMessage.error((e as Error).message);
    autoOn[wf.id] = !enable; // 回滚开关
  }
}
onMounted(() => load());
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (tickTimer) clearInterval(tickTimer);
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

function mediaSrc(u?: string) {
  return !u ? "" : u.startsWith("http") ? u : `/${u}`;
}

// —— 生成参数对话框(按节点类型) ——
const dlg = ref(false);
const dlgKind = ref<"image" | "copy" | "video" | "">("");
const pending = ref<{ wfId: string; nodeId: string; regen: boolean } | null>(null);
// 图片
const models = ref<ModelImage[]>([]);
const selectedModel = ref("");
const imgPrompt = ref(DEFAULT_TRYON_PROMPT);
// 换装图档位(都可选,默认 "1")
const imgPose = ref("1"); // 姿势
const imgChest = ref("1"); // 胸部
const imgWaist = ref("1"); // 腰臀比
const imgOutput = ref("1"); // 输出方式
// 文案
const copyPrompt = ref("");
const versionCount = ref(3);
// 视频
const refVideos = ref<ReferenceVideo[]>([]);
const selectedRefVideo = ref("");

// 选中项的完整预览 URL(用于弹窗里的大图/可播放预览,不裁切)
const selectedModelUrl = computed(() => {
  const m = models.value.find((x) => x.id === selectedModel.value);
  return m ? mediaSrc(m.mediaUrl) : "";
});
const selectedRefVideoUrl = computed(() => {
  const r = refVideos.value.find((x) => x.id === selectedRefVideo.value);
  return r ? mediaSrc(r.mediaUrl) : "";
});
// 新视频工作流全部可调项(16 项,都可选,不传用工作流默认)。
// 通过节点动作端点 body 随 execute 传出:api.workflowAction(wfId, nodeId, "execute", { referenceVideoId, ...vp })。
const VP_DEFAULTS = {
  zipMode: "1", // 输出方式:1=正常输出(cn站)、2=ZIP(cn站不支持)
  poseCalcMode: "2", // 姿势计算方式:1=姿势1(快)、2=姿势2 sdpose(慢·更准)
  poseLongNeck: false, // 姿势3·脖子长时开启
  poseStrength: 1.0, // 姿势强度
  cameraMove: false, // 运镜开关
  cameraStrength: 1.0, // 运镜强度
  maskHelmet: false, // 面具头盔模式
  expressionIntensity: 0.6, // 表情强度
  ruKilnAmplitude: 0.27, // 胸部抖动幅度
  skipFrames: 0, // 跳过前面多少帧
  maxFrames: 840, // 加载帧上限(时长≈帧数÷帧率)
  frameRate: 30, // 帧率
  resolution: "2", // 分辨率:1=720P、2=1080P(推荐)
  customRatio: false, // 开启自定义比例
  ratioW: 9, // 自定义比例·宽
  ratioH: 16, // 自定义比例·高
} as const;
const vp = reactive({ ...VP_DEFAULTS });
function resetVp() {
  Object.assign(vp, VP_DEFAULTS);
}

const GEN_KINDS = ["image", "copy", "video"];

async function runAction(wfId: string, nodeId: string, action: string, kind?: string, regen = false) {
  if (action === "execute" && kind && GEN_KINDS.includes(kind)) {
    pending.value = { wfId, nodeId, regen };
    dlgKind.value = kind as "image" | "copy" | "video";
    if (kind === "image") {
      selectedModel.value = "";
      imgPrompt.value = DEFAULT_TRYON_PROMPT;
      imgPose.value = "1";
      imgChest.value = "1";
      imgWaist.value = "1";
      imgOutput.value = "1";
      models.value = await api.listModelImages().catch(() => []);
    } else if (kind === "copy") {
      copyPrompt.value = "";
      versionCount.value = 3;
    } else if (kind === "video") {
      selectedRefVideo.value = "";
      resetVp();
      refVideos.value = await api.listReferenceVideos().catch(() => []);
    }
    dlg.value = true;
    return;
  }
  await doAct(wfId, nodeId, action);
}

async function doAct(wfId: string, nodeId: string, action: string, params: Record<string, unknown> = {}) {
  try {
    await api.workflowAction(wfId, nodeId, action, params);
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function confirmGenerate() {
  const p = pending.value;
  if (!p) return;
  let params: Record<string, unknown> = {};
  if (dlgKind.value === "image") {
    if (!selectedModel.value) return ElMessage.warning("请选择一张模特图");
    params = {
      modelImageId: selectedModel.value,
      prompt: imgPrompt.value,
      poseMode: imgPose.value,
      chestMode: imgChest.value,
      waistHipMode: imgWaist.value,
      outputMode: imgOutput.value,
    };
  } else if (dlgKind.value === "copy") {
    params = { prompt: copyPrompt.value || undefined, versionCount: versionCount.value };
  } else if (dlgKind.value === "video") {
    if (!selectedRefVideo.value) return ElMessage.warning("请选择一段参考视频");
    params = { referenceVideoId: selectedRefVideo.value, ...vp };
  }
  dlg.value = false;
  if (p.regen) await api.workflowAction(p.wfId, p.nodeId, "rearm").catch(() => {}); // 已成功→可执行
  await doAct(p.wfId, p.nodeId, "execute", params);
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
// 已成功=重新生成;已跳过=补生成(之前跳过了想重新生成)。都走 rearm→execute。
function canRegen(node: { status: string; kind?: string }) {
  return (
    ["已成功", "已跳过"].includes(node.status) && !!node.kind && GEN_KINDS.includes(node.kind)
  );
}
function regenLabel(status: string) {
  return status === "已跳过" ? "生成" : "重新生成";
}
function wfTagType(status?: string) {
  if (status === "已完成") return "success";
  if (status === "失败") return "danger";
  if (status === "等待确认") return "warning";
  return "info";
}
// runStage 子状态的 tag 类型:排队中→灰(info)、生成中→绿(success/processing)
function runStageTagType(stage?: string) {
  return stage === "排队中" ? "info" : "success";
}

const dlgTitle = () =>
  dlgKind.value === "image" ? "换装生图参数" : dlgKind.value === "copy" ? "文案生成参数" : "视频生成参数";
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
          <el-switch
            v-model="autoOn[wf.id]"
            active-text="自动推进"
            size="small"
            @change="(val: string | number | boolean) => onAutoChange(wf, val)"
          />
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
              v-if="node.optional"
              size="small"
              type="info"
              effect="plain"
              title="自动模式会自动跳过,需要时手动确认"
            >可选</el-tag>
            <el-tag
              size="small"
              effect="plain"
              :style="{ color: color(node.status), borderColor: color(node.status) }"
            >{{ node.status }}</el-tag>
            <template v-if="node.status === '执行中'">
              <el-tag size="small" :type="runStageTagType(node.runStage)" effect="plain">
                {{ node.runStage || '生成中' }}
              </el-tag>
              <span v-if="node.updatedAt" class="tip">已进行 {{ fmtElapsed(elapsedSec(node)) }}</span>
            </template>
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
                v-if="canRegen(node)"
                size="small"
                :type="node.status === '已跳过' ? 'primary' : ''"
                @click="runAction(wf.id, node.id, 'execute', node.kind, true)"
              >{{ regenLabel(node.status) }}</el-button>
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

    <el-dialog v-model="dlg" :title="dlgTitle()" width="600px">
      <!-- 图片:模特图 + 提示词 -->
      <template v-if="dlgKind === 'image'">
        <div class="field-label">模特图(node41,选一张人物)</div>
        <el-empty v-if="!models.length" description="模特图库为空,请先到「模特图库」上传" :image-size="60" />
        <div v-else class="media-grid">
          <div
            v-for="m in models"
            :key="m.id"
            class="media-cell"
            :class="{ sel: selectedModel === m.id }"
            @click="selectedModel = m.id"
          >
            <el-image :src="mediaSrc(m.mediaUrl)" fit="cover" style="width: 110px; height: 110px" />
          </div>
        </div>
        <div v-if="selectedModelUrl" class="media-preview">
          <el-image
            :src="selectedModelUrl"
            fit="contain"
            :preview-src-list="[selectedModelUrl]"
            :preview-teleported="true"
            style="max-width: 100%; max-height: 320px"
          />
          <p class="tip">👆 已选模特图 · 点击可放大看原图</p>
        </div>
        <div class="field-label">换装提示词(node68,默认已填,可改)</div>
        <el-input v-model="imgPrompt" type="textarea" :rows="3" />
        <div class="vp-grid" style="margin-top: 12px">
          <label>姿势
            <el-select v-model="imgPose" size="small" style="width: 180px">
              <el-option label="保持原姿势(默认)" value="1" />
              <el-option label="站立姿势" value="2" />
            </el-select>
          </label>
          <label>胸部
            <el-select v-model="imgChest" size="small" style="width: 180px">
              <el-option label="默认不改变(默认)" value="1" />
              <el-option label="D/E 饱满纯欲不夸张" value="2" />
              <el-option label="C 标准自然百搭" value="3" />
              <el-option label="A/B 小巧清纯" value="4" />
            </el-select>
          </label>
          <label>腰臀比
            <el-select v-model="imgWaist" size="small" style="width: 180px">
              <el-option label="标准(默认)" value="1" />
              <el-option label="强化" value="2" />
            </el-select>
          </label>
          <label>输出方式
            <el-select v-model="imgOutput" size="small" style="width: 180px">
              <el-option label="直出(默认)" value="1" />
              <el-option label="ZIP" value="2" />
            </el-select>
          </label>
        </div>
        <p v-if="imgOutput === '2'" class="tip">ZIP:打包输出,绕过内容安审,图更不容易被拦。</p>
        <p class="tip">服装图自动用该商品的「商品原图」(node79)。</p>
      </template>

      <!-- 文案:提示词 + 条数 -->
      <template v-else-if="dlgKind === 'copy'">
        <div class="field-label">补充提示词(可选,留空用默认风格)</div>
        <el-input v-model="copyPrompt" type="textarea" :rows="3" placeholder="例:突出性价比、场景化、第一人称…" />
        <div class="field-label">生成条数</div>
        <el-input-number v-model="versionCount" :min="1" :max="5" />
      </template>

      <!-- 视频:参考视频 + 微调参数 -->
      <template v-else-if="dlgKind === 'video'">
        <div class="field-label">参考视频(node275,选一段,决定动作/节奏)</div>
        <el-empty v-if="!refVideos.length" description="参考视频库为空,请先到「参考视频库」上传" :image-size="60" />
        <div v-else class="media-grid">
          <div
            v-for="r in refVideos"
            :key="r.id"
            class="media-cell"
            :class="{ sel: selectedRefVideo === r.id }"
            @click="selectedRefVideo = r.id"
          >
            <video :src="mediaSrc(r.mediaUrl)" muted style="width: 130px; height: 110px; object-fit: cover" />
            <div class="rv-name">{{ r.name }}</div>
          </div>
        </div>
        <div v-if="selectedRefVideoUrl" class="media-preview">
          <video
            :src="selectedRefVideoUrl"
            controls
            muted
            playsinline
            style="max-width: 100%; max-height: 320px; background: #000; border-radius: 6px"
          />
          <p class="tip">👆 已选参考视频 · 可播放预览</p>
        </div>
        <p class="tip">参考图自动用「最新生成的换装图」(node299)。以下参数一般用默认,可微调:</p>
        <div class="field-label">基础</div>
        <div class="vp-grid">
          <label>帧率 <el-input-number v-model="vp.frameRate" :min="1" size="small" controls-position="right" /></label>
          <label>加载帧上限 <el-input-number v-model="vp.maxFrames" :min="1" size="small" controls-position="right" /></label>
          <label>分辨率
            <el-select v-model="vp.resolution" size="small" style="width: 130px">
              <el-option label="720P" value="1" />
              <el-option label="1080P(推荐)" value="2" />
            </el-select>
          </label>
          <label>表情强度 <el-input-number v-model="vp.expressionIntensity" :min="0" :max="1" :step="0.05" size="small" controls-position="right" /></label>
          <label>胸部抖动幅度 <el-input-number v-model="vp.ruKilnAmplitude" :min="0" :max="1" :step="0.01" size="small" controls-position="right" /></label>
        </div>
        <p class="tip">时长 ≈ 加载帧上限 ÷ 帧率(如 840÷30 ≈ 28 秒)。</p>
        <div class="field-label">进阶(一般默认)</div>
        <div class="vp-grid">
          <label>姿势计算方式
            <el-select v-model="vp.poseCalcMode" size="small" style="width: 180px">
              <el-option label="姿势1(快)" value="1" />
              <el-option label="姿势2 sdpose(慢·更准)" value="2" />
            </el-select>
          </label>
          <label>姿势3·脖子长时开启 <el-switch v-model="vp.poseLongNeck" /></label>
          <label>姿势强度 <el-input-number v-model="vp.poseStrength" :step="0.1" size="small" controls-position="right" /></label>
          <label>运镜开关 <el-switch v-model="vp.cameraMove" /></label>
          <label>运镜强度 <el-input-number v-model="vp.cameraStrength" :step="0.1" size="small" controls-position="right" /></label>
          <label>面具头盔模式 <el-switch v-model="vp.maskHelmet" /></label>
          <label>跳过前面多少帧 <el-input-number v-model="vp.skipFrames" :min="0" size="small" controls-position="right" /></label>
          <label>输出方式
            <el-select v-model="vp.zipMode" size="small" style="width: 180px">
              <el-option label="正常输出(cn站)" value="1" />
              <el-option label="ZIP(cn站不支持)" value="2" />
            </el-select>
          </label>
          <label>开启自定义比例 <el-switch v-model="vp.customRatio" /></label>
          <label>自定义比例·宽 <el-input-number v-model="vp.ratioW" :min="1" size="small" controls-position="right" /></label>
          <label>自定义比例·高 <el-input-number v-model="vp.ratioH" :min="1" size="small" controls-position="right" /></label>
        </div>
        <p class="tip">cn站不支持ZIP,一般用正常输出。</p>
      </template>

      <template #footer>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" @click="confirmGenerate">开始生成</el-button>
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
.field-label {
  font-size: 13px;
  color: #475569;
  margin: 12px 0 6px;
}
.field-label:first-child {
  margin-top: 0;
}
.media-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.media-cell {
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  line-height: 0;
}
.media-cell.sel {
  border-color: #2563eb;
}
.media-preview {
  margin: 10px 0;
  text-align: center;
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.media-preview .tip {
  margin: 6px 0 0;
}
.rv-name {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.4;
  padding: 2px 4px;
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tip {
  color: #94a3b8;
  font-size: 12px;
  margin: 8px 0;
}
.vp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.vp-grid label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #475569;
  gap: 8px;
}
</style>
