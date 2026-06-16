<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, type NewProduct, type ProductDetail } from "../api";

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

async function load() {
  loading.value = true;
  try {
    product.value = await api.getProduct(route.params.id as string);
    error.value = "";
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function mediaSrc(url?: string) {
  if (!url) return "";
  return url.startsWith("http") ? url : `/${url}`;
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

    <h3>素材（{{ product.assets.length }}）</h3>
    <el-empty v-if="!product.assets.length" description="暂无素材" />
    <div v-else class="assets">
      <div v-for="a in product.assets" :key="a.id" class="asset">
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
        <div class="cap">[{{ a.kind }}] {{ a.name }}</div>
      </div>
    </div>

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
</style>
