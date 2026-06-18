<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import {
  type CredentialConfigInput,
  type CredentialTokenInput,
  type OAuthGuide,
  type PlatformCredential,
  api,
} from "../api";

const list = ref<PlatformCredential[]>([]);
const loading = ref(true);
const error = ref("");

const API_LABEL: Record<string, string> = {
  douyin_shop: "抖店 · 主店上架",
  douyin_open: "抖音开放 · 矩阵发布",
};
const RUN_MODE: Record<string, { label: string; type: string; tip: string }> = {
  demo: { label: "演示", type: "info", tip: "假成功跑通流程,不调真实平台" },
  real: { label: "真实", type: "success", tip: "调真实平台;凭证不全时自动降级人工" },
  manual: { label: "人工任务包", type: "warning", tip: "产出操作步骤,人工到后台执行" },
};
function statusType(s: string) {
  if (s === "已授权") return "success";
  if (s === "失败") return "danger";
  return "info";
}
function fmtExpiry(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("zh-CN");
}

async function load() {
  loading.value = true;
  try {
    list.value = await api.listCredentials();
    error.value = "";
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

// —— 配置弹窗(appKey/appSecret) ——
const cfgVisible = ref(false);
const cfgSaving = ref(false);
const cfg = reactive<CredentialConfigInput>({
  platform: "抖音",
  api: "douyin_shop",
  label: "",
  role: "",
  appKey: "",
  appSecret: "",
});
function openNew() {
  Object.assign(cfg, {
    platform: "抖音",
    api: "douyin_shop",
    label: "",
    role: "",
    appKey: "",
    appSecret: "",
  });
  cfgVisible.value = true;
}
function openEdit(row: PlatformCredential) {
  Object.assign(cfg, {
    platform: row.platform,
    api: row.api,
    label: row.label,
    role: row.role,
    appKey: row.appKey,
    appSecret: "", // 不回填密文;留空则保持原值
  });
  cfgVisible.value = true;
}
async function saveCfg() {
  if (!cfg.platform || !cfg.api) {
    ElMessage.warning("请选择平台与接口通道");
    return;
  }
  cfgSaving.value = true;
  try {
    const payload: CredentialConfigInput = { ...cfg };
    if (!payload.appSecret) payload.appSecret = undefined; // 空 → 不改密钥
    await api.saveCredential(payload);
    ElMessage.success("已保存配置");
    cfgVisible.value = false;
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    cfgSaving.value = false;
  }
}

// —— 运行模式切换 ——
async function changeRunMode(row: PlatformCredential, mode: string) {
  try {
    await api.setCredentialRunMode(row.id, mode);
    ElMessage.success(`已切到「${RUN_MODE[mode]?.label || mode}」模式`);
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
    await load();
  }
}

// —— 贴 token 弹窗 ——
const tokVisible = ref(false);
const tokSaving = ref(false);
const tokTarget = ref<PlatformCredential | null>(null);
const tok = reactive<CredentialTokenInput & { expiresDays: number }>({
  accessToken: "",
  refreshToken: "",
  shopId: "",
  expiresDays: 7,
});
function openToken(row: PlatformCredential) {
  tokTarget.value = row;
  Object.assign(tok, { accessToken: "", refreshToken: "", shopId: row.shopId || "", expiresDays: 7 });
  tokVisible.value = true;
}
async function saveToken() {
  if (!tokTarget.value) return;
  if (!tok.accessToken.trim()) {
    ElMessage.warning("请填写 access_token");
    return;
  }
  tokSaving.value = true;
  try {
    await api.saveCredentialTokens(tokTarget.value.id, {
      accessToken: tok.accessToken.trim(),
      refreshToken: tok.refreshToken?.trim() || undefined,
      shopId: tok.shopId?.trim() || undefined,
      expiresInSec: tok.expiresDays > 0 ? tok.expiresDays * 86400 : undefined,
    });
    ElMessage.success("已保存 token,状态置为「已授权」");
    tokVisible.value = false;
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    tokSaving.value = false;
  }
}

// —— 授权指引弹窗 ——
const guideVisible = ref(false);
const guide = ref<OAuthGuide | null>(null);
async function openGuide(row: PlatformCredential) {
  try {
    guide.value = await api.getCredentialOAuthUrl(row.id);
    guideVisible.value = true;
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function remove(row: PlatformCredential) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.platform} · ${API_LABEL[row.api] || row.api}」凭证?`, "删除确认", {
      type: "warning",
    });
  } catch {
    return;
  }
  try {
    await api.deleteCredential(row.id);
    ElMessage.success("已删除");
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}
</script>

<template>
  <div class="header">
    <h2>平台凭证 · 接入配置</h2>
    <el-button type="primary" @click="openNew">新增凭证</el-button>
  </div>

  <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
    <template #title>没有开发者 key 也能用</template>
    现在可先建配置、用「演示/人工」模式跑通上架发布链路。等抖店应用与 key 办好后,回这里填
    app_key/app_secret、贴 token,把运行模式切到「真实」即转真实调用。密钥与 token 全程加密落库,页面只显示是否已配置。
  </el-alert>

  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
  <el-skeleton v-if="loading" :rows="4" animated />
  <el-empty v-else-if="!list.length" description="还没有凭证,点右上角「新增凭证」开始" />
  <el-table v-else :data="list" border>
    <el-table-column label="平台 / 接口" min-width="190">
      <template #default="{ row }">
        <div><strong>{{ row.platform }}</strong></div>
        <div style="color: var(--el-text-color-secondary); font-size: 12px">{{ API_LABEL[row.api] || row.api }}</div>
        <div v-if="row.label" style="color: var(--el-text-color-secondary); font-size: 12px">{{ row.label }}</div>
      </template>
    </el-table-column>
    <el-table-column label="app_key" min-width="120">
      <template #default="{ row }">
        <span v-if="row.appKey">{{ row.appKey }}</span>
        <el-tag v-else size="small" type="info">未填</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="密钥 / token" width="150">
      <template #default="{ row }">
        <el-tag size="small" :type="row.appSecretSet ? 'success' : 'info'">
          secret {{ row.appSecretSet ? "已配" : "未配" }}
        </el-tag>
        <el-tag size="small" :type="row.tokenSet ? 'success' : 'info'" style="margin-top: 4px">
          token {{ row.tokenSet ? "已配" : "未配" }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="授权状态" width="150">
      <template #default="{ row }">
        <el-tag size="small" :type="statusType(row.status)">{{ row.status }}</el-tag>
        <div v-if="row.tokenSet" style="color: var(--el-text-color-secondary); font-size: 12px; margin-top: 4px">
          过期 {{ fmtExpiry(row.tokenExpiresAt) }}
        </div>
        <div v-if="row.lastError" style="color: var(--el-color-danger); font-size: 12px">{{ row.lastError }}</div>
      </template>
    </el-table-column>
    <el-table-column label="运行模式" width="170">
      <template #default="{ row }">
        <el-select :model-value="row.runMode" size="small" @change="(m: string) => changeRunMode(row, m)">
          <el-option v-for="(v, k) in RUN_MODE" :key="k" :value="k" :label="v.label" />
        </el-select>
        <div style="color: var(--el-text-color-secondary); font-size: 12px; margin-top: 4px">
          {{ RUN_MODE[row.runMode]?.tip }}
        </div>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="260" fixed="right">
      <template #default="{ row }">
        <el-button size="small" @click="openEdit(row)">配置</el-button>
        <el-button size="small" type="primary" @click="openToken(row)">贴 token</el-button>
        <el-button size="small" link @click="openGuide(row)">授权指引</el-button>
        <el-button size="small" link type="danger" @click="remove(row)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>

  <!-- 配置弹窗 -->
  <el-dialog v-model="cfgVisible" title="凭证配置" width="480px">
    <el-form label-width="92px">
      <el-form-item label="平台">
        <el-select v-model="cfg.platform" style="width: 100%">
          <el-option value="抖音" label="抖音" />
        </el-select>
      </el-form-item>
      <el-form-item label="接口通道">
        <el-select v-model="cfg.api" style="width: 100%">
          <el-option value="douyin_shop" label="抖店 · 主店上架" />
          <el-option value="douyin_open" label="抖音开放 · 矩阵发布" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="cfg.label" placeholder="如:主店上架专用" />
      </el-form-item>
      <el-form-item label="app_key">
        <el-input v-model="cfg.appKey" placeholder="抖店应用 app_key" />
      </el-form-item>
      <el-form-item label="app_secret">
        <el-input v-model="cfg.appSecret" type="password" show-password placeholder="留空则不修改已存密钥" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="cfgVisible = false">取消</el-button>
      <el-button type="primary" :loading="cfgSaving" @click="saveCfg">保存</el-button>
    </template>
  </el-dialog>

  <!-- 贴 token 弹窗 -->
  <el-dialog v-model="tokVisible" title="手动保存 token" width="480px">
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      在抖店后台完成自身店铺授权后,把拿到的 token 贴进来;系统加密落库并置为「已授权」。
    </el-alert>
    <el-form label-width="110px">
      <el-form-item label="access_token">
        <el-input v-model="tok.accessToken" type="textarea" :rows="2" placeholder="必填" />
      </el-form-item>
      <el-form-item label="refresh_token">
        <el-input v-model="tok.refreshToken" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
      <el-form-item label="店铺 shop_id">
        <el-input v-model="tok.shopId" placeholder="可选" />
      </el-form-item>
      <el-form-item label="有效期(天)">
        <el-input-number v-model="tok.expiresDays" :min="0" :max="365" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="tokVisible = false">取消</el-button>
      <el-button type="primary" :loading="tokSaving" @click="saveToken">保存</el-button>
    </template>
  </el-dialog>

  <!-- 授权指引弹窗 -->
  <el-dialog v-model="guideVisible" title="授权指引" width="560px">
    <template v-if="guide">
      <el-steps direction="vertical" :active="guide.steps.length" style="margin-bottom: 8px">
        <el-step v-for="(s, i) in guide.steps" :key="i" :title="s" />
      </el-steps>
      <p>
        授权入口:<el-link :href="guide.authConsole" target="_blank" type="primary">{{ guide.authConsole }}</el-link>
      </p>
      <p style="color: var(--el-text-color-secondary); font-size: 13px">token 接口模板:</p>
      <el-input :model-value="guide.tokenTemplate" readonly />
      <el-alert type="warning" :closable="false" show-icon style="margin-top: 12px">{{ guide.note }}</el-alert>
    </template>
  </el-dialog>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
</style>
