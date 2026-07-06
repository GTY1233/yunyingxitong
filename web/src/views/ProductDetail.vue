<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, type NewProduct, type ProductDetail, type PublishPackage } from "../api";
import WorkflowPanel from "../components/WorkflowPanel.vue";

const route = useRoute();
const router = useRouter();
const product = ref<ProductDetail | null>(null);
const loading = ref(true);
const error = ref("");
const dialog = ref(false);
const saving = ref(false);

const form = reactive({
  name: "",
  category: "",
  price: undefined as number | undefined,
  stock: undefined as number | undefined,
  sellingPoints: "",
  specs: "",
});

async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    product.value = await api.getProduct(route.params.id as string);
    error.value = "";
  } catch (e) {
    if (!silent) error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(async () => {
  await load();
  if (product.value) await loadPackage();
});

function mediaSrc(url?: string) {
  if (!url) return "";
  return url.startsWith("http") ? url : `/${url}`;
}

// 原图(上传输入)与生成素材(产出)分开展示
const originals = computed(() => product.value?.assets.filter((a) => a.kind === "original") || []);
const outputs = computed(() => product.value?.assets.filter((a) => a.kind !== "original") || []);

// 发布素材:生成好的可发布视频 + 文案 + 标签
const pkg = ref<PublishPackage | null>(null);
const pkgLoading = ref(false);
const pkgError = ref("");

async function loadPackage() {
  const p = product.value;
  if (!p) return;
  pkgLoading.value = true;
  try {
    pkg.value = await api.getPublishPackage(p.id);
    pkgError.value = "";
  } catch (e) {
    pkgError.value = (e as Error).message;
  } finally {
    pkgLoading.value = false;
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("已复制");
  } catch {
    ElMessage.error("复制失败");
  }
}

async function customUpload(opt: any) {
  if (!product.value) return;
  try {
    await api.uploadProductImage(product.value.id, opt.file as File);
    ElMessage.success("原图已上传");
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function removeAsset(id: string) {
  try {
    await api.deleteAsset(id);
    ElMessage.success("已删除");
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

function openEdit() {
  const p = product.value;
  if (!p) return;
  Object.assign(form, {
    name: p.name || "",
    category: p.category || "",
    price: p.priceCents != null ? p.priceCents / 100 : undefined,
    stock: p.stock,
    sellingPoints: p.sellingPoints || "",
    specs: p.specs || "",
  });
  dialog.value = true;
}

async function save() {
  if (!product.value) return;
  saving.value = true;
  try {
    const body: Partial<NewProduct> = {
      name: form.name.trim(),
      category: form.category || undefined,
      priceCents: form.price != null ? Math.round(form.price * 100) : undefined,
      stock: form.stock ?? undefined,
      sellingPoints: form.sellingPoints || undefined,
      specs: form.specs || undefined,
    };
    await api.updateProduct(product.value.id, body);
    ElMessage.success("已保存");
    dialog.value = false;
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!product.value) return;
  try {
    await ElMessageBox.confirm(`确定删除「${product.value.name}」？`, "删除商品", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return; // 取消
  }
  try {
    await api.deleteProduct(product.value.id);
    ElMessage.success("已删除");
    router.push("/products");
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}
</script>

<template>
  <div class="head">
    <el-button text @click="router.back()">← 返回列表</el-button>
    <div v-if="product">
      <el-button @click="openEdit"><el-icon><Edit /></el-icon>编辑</el-button>
      <el-button type="danger" plain @click="remove"><el-icon><Delete /></el-icon>删除</el-button>
    </div>
  </div>

  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" />
  <el-skeleton v-if="loading" :rows="6" animated />

  <div v-else-if="product">
    <h2>
      {{ product.name }}
      <el-tag size="small">{{ product.displayCode || "未编号" }}</el-tag>
    </h2>

    <el-descriptions :column="3" border>
      <el-descriptions-item label="价格">¥{{ ((product.priceCents ?? 0) / 100).toFixed(2) }}</el-descriptions-item>
      <el-descriptions-item label="库存">{{ product.stock }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ product.status }}</el-descriptions-item>
      <el-descriptions-item label="卖点">{{ product.sellingPoints || "—" }}</el-descriptions-item>
      <el-descriptions-item label="规格">{{ product.specs || "—" }}</el-descriptions-item>
      <el-descriptions-item label="派生状态">
        图 {{ product.derivedStatus.imageStatus }} / 文 {{ product.derivedStatus.copyStatus }} / 视频
        {{ product.derivedStatus.videoStatus }}
      </el-descriptions-item>
    </el-descriptions>

    <h3>商品原图（{{ originals.length }}）</h3>
    <div class="assets">
      <div v-for="a in originals" :key="a.id" class="asset original">
        <el-image
          :src="mediaSrc(a.mediaUrl)"
          fit="cover"
          style="width: 160px; height: 160px; border-radius: 8px"
          :preview-src-list="[mediaSrc(a.mediaUrl)]"
        />
        <el-button class="del-btn" size="small" text type="danger" @click="removeAsset(a.id)">删除</el-button>
      </div>
      <el-upload
        class="uploader"
        :http-request="customUpload"
        :show-file-list="false"
        accept="image/png,image/jpeg,image/webp,image/gif"
        drag
      >
        <div class="up-inner">
          <el-icon :size="22"><Upload /></el-icon>
          <div>上传原图</div>
        </div>
      </el-upload>
    </div>
    <p class="hint">上传商品原始图后，图片/视频生成节点才能用它作 AI 生成参考。</p>

    <h3>生成素材（{{ outputs.length }}）</h3>
    <el-empty v-if="!outputs.length" description="暂无生成素材，去下方工作流生成" :image-size="60" />
    <div v-else class="assets">
      <div v-for="a in outputs" :key="a.id" class="asset">
        <el-image
          v-if="a.kind === 'image'"
          :src="mediaSrc(a.mediaUrl)"
          fit="cover"
          style="width: 240px; height: 240px; border-radius: 8px"
          :preview-src-list="[mediaSrc(a.mediaUrl)]"
        />
        <video
          v-else-if="a.kind === 'video'"
          :src="mediaSrc(a.mediaUrl)"
          controls
          style="width: 240px; border-radius: 8px"
        />
        <el-card v-else shadow="never">{{ a.content }}</el-card>
        <div class="cap">
          [{{ a.kind }}] {{ a.name }}
          <el-tag
            v-if="a.isAiGenerated"
            size="small"
            type="info"
            effect="plain"
            :title="a.aiNote || 'AI生成'"
          >AI</el-tag>
        </div>
      </div>
    </div>

    <h3>发布素材</h3>
    <el-skeleton v-if="pkgLoading" :rows="3" animated />
    <el-alert
      v-else-if="pkgError"
      :title="`加载失败：${pkgError}`"
      type="error"
      show-icon
      :closable="false"
    />
    <el-empty
      v-else-if="!pkg || !pkg.ready"
      description="还没有可发布的视频，先在下方工作流生成视频"
      :image-size="60"
    />
    <el-card v-else shadow="never" class="publish-pkg">
      <div class="pub-row">
        <video
          v-if="pkg.videoUrl"
          :src="mediaSrc(pkg.videoUrl)"
          controls
          style="max-width: 240px; border-radius: 8px"
        />
        <div class="pub-fields">
          <div class="pub-field">
            <label>标题</label>
            <div class="pub-value">
              <span class="pub-text">{{ pkg.title || "—" }}</span>
              <el-button
                v-if="pkg.title"
                link
                size="small"
                type="primary"
                @click="copyText(pkg.title)"
              >复制</el-button>
            </div>
          </div>
          <div class="pub-field">
            <label>正文</label>
            <div class="pub-value">
              <span class="pub-text pub-desc">{{ pkg.desc || "—" }}</span>
              <el-button
                v-if="pkg.desc"
                link
                size="small"
                type="primary"
                @click="copyText(pkg.desc)"
              >复制</el-button>
            </div>
          </div>
          <div class="pub-field">
            <label>标签</label>
            <div class="pub-value">
              <div class="pub-tags">
                <el-tag v-for="t in pkg.tags" :key="t" size="small">{{ t }}</el-tag>
                <span v-if="!pkg.tags.length" class="pub-text">—</span>
              </div>
              <el-button
                v-if="pkg.tags.length"
                link
                size="small"
                type="primary"
                @click="copyText(pkg.tags.join('，'))"
              >复制全部</el-button>
            </div>
          </div>
        </div>
      </div>
      <div class="pub-status">
        <el-tag v-if="pkg.autoPublishEnabled" type="success" size="small">已接自动发布</el-tag>
        <el-tag v-else type="info" size="small">
          未接自动发布——下载视频+复制文案，去平台网页版手动发
        </el-tag>
      </div>
    </el-card>

    <WorkflowPanel :product-id="product.id" @changed="load(true)" />

    <el-dialog v-model="dialog" title="编辑商品" width="520px">
      <el-form label-width="92px">
        <el-form-item label="名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类目"><el-input v-model="form.category" /></el-form-item>
        <el-form-item label="价格(元)">
          <el-input-number v-model="form.price" :min="0" :precision="2" :step="1" />
        </el-form-item>
        <el-form-item label="库存"><el-input-number v-model="form.stock" :min="0" /></el-form-item>
        <el-form-item label="卖点"><el-input v-model="form.sellingPoints" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="规格"><el-input v-model="form.specs" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.asset.original {
  width: 160px;
}
.del-btn {
  margin-top: 2px;
}
.uploader :deep(.el-upload-dragger) {
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.up-inner {
  color: #94a3b8;
  text-align: center;
  font-size: 13px;
}
.hint {
  color: #94a3b8;
  font-size: 12px;
  margin: 4px 0 0;
}
.publish-pkg .pub-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
.pub-fields {
  flex: 1;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pub-field label {
  display: block;
  color: #94a3b8;
  font-size: 12px;
  margin-bottom: 2px;
}
.pub-value {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.pub-text {
  flex: 1;
}
.pub-desc {
  white-space: pre-wrap;
}
.pub-tags {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pub-status {
  margin-top: 14px;
}
</style>
