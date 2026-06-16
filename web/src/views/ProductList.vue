<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api, type NewProduct, type Product } from "../api";

const router = useRouter();
const products = ref<Product[]>([]);
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
    products.value = await api.listProducts();
    error.value = "";
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function yuan(c?: number) {
  return c == null ? "-" : `¥${(c / 100).toFixed(2)}`;
}
function open(row: Product) {
  router.push(`/products/${row.id}`);
}
function openCreate() {
  Object.assign(form, {
    name: "",
    category: "",
    price: undefined,
    stock: undefined,
    sellingPoints: "",
    specs: "",
  });
  dialog.value = true;
}
async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning("请填写商品名称");
    return;
  }
  saving.value = true;
  try {
    const body: NewProduct = {
      name: form.name.trim(),
      category: form.category || undefined,
      priceCents: form.price != null ? Math.round(form.price * 100) : undefined,
      stock: form.stock ?? undefined,
      sellingPoints: form.sellingPoints || undefined,
      specs: form.specs || undefined,
    };
    await api.createProduct(body);
    ElMessage.success("已创建");
    dialog.value = false;
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="head">
    <h2>商品列表</h2>
    <el-button type="primary" @click="openCreate">
      <el-icon><Plus /></el-icon>新建商品
    </el-button>
  </div>

  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" />
  <el-skeleton v-if="loading" :rows="5" animated />
  <el-empty v-else-if="!products.length" description="暂无商品，点右上角新建" />
  <el-table v-else :data="products" style="cursor: pointer" @row-click="open">
    <el-table-column prop="displayCode" label="编号" width="110" />
    <el-table-column prop="name" label="名称" min-width="160" />
    <el-table-column label="价格" width="120">
      <template #default="{ row }">{{ yuan(row.priceCents) }}</template>
    </el-table-column>
    <el-table-column prop="stock" label="库存" width="90" />
    <el-table-column label="状态" width="120">
      <template #default="{ row }">
        <el-tag size="small" :type="row.status === '已发布' ? 'success' : 'info'">{{ row.status }}</el-tag>
      </template>
    </el-table-column>
  </el-table>

  <el-dialog v-model="dialog" title="新建商品" width="520px">
    <el-form label-width="92px">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="商品名称" />
      </el-form-item>
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
      <el-button type="primary" :loading="saving" @click="submit">创建</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
