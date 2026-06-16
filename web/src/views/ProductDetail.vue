<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, type ProductDetail } from "../api";

const route = useRoute();
const router = useRouter();
const product = ref<ProductDetail | null>(null);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    product.value = await api.getProduct(route.params.id as string);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});

// 资产媒体在后端是 "media-backup/..." 相对路径，加前导斜杠走代理。
function mediaSrc(url?: string) {
  if (!url) return "";
  return url.startsWith("http") ? url : `/${url}`;
}
</script>

<template>
  <el-button text @click="router.back()">← 返回列表</el-button>
  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" />
  <el-skeleton v-if="loading" :rows="6" animated />

  <div v-else-if="product">
    <h2>
      {{ product.name }}
      <el-tag size="small">{{ product.displayCode }}</el-tag>
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
  </div>
</template>
