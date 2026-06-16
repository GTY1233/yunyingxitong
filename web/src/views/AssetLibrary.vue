<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api, type AssetWithProduct } from "../api";

type Kind = "all" | "image" | "video" | "copy";

const assets = ref<AssetWithProduct[]>([]);
const loading = ref(true);
const error = ref("");
const kind = ref<Kind>("all");

onMounted(async () => {
  try {
    assets.value = await api.listAssets();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});

function mediaSrc(u?: string) {
  return !u ? "" : u.startsWith("http") ? u : "/" + u;
}

const counts = computed(() => ({
  all: assets.value.length,
  image: assets.value.filter((a) => a.kind === "image").length,
  video: assets.value.filter((a) => a.kind === "video").length,
  copy: assets.value.filter((a) => a.kind === "copy").length,
}));

const filtered = computed(() =>
  kind.value === "all" ? assets.value : assets.value.filter((a) => a.kind === kind.value),
);

// 图片预览列表：当前筛选结果里所有图片，便于点击放大后左右切换
const previewList = computed(() =>
  filtered.value.filter((a) => a.kind === "image").map((a) => mediaSrc(a.mediaUrl)),
);

function productLabel(a: AssetWithProduct) {
  const name = a.product?.name ?? "未关联商品";
  const code = a.product?.displayCode;
  return code ? `${name}（${code}）` : name;
}
</script>

<template>
  <h2>素材库</h2>

  <el-alert v-if="error" :title="`加载失败：${error}`" type="error" show-icon :closable="false" />
  <el-skeleton v-if="loading" :rows="5" animated />
  <template v-else>
    <div class="bar">
      <el-radio-group v-model="kind">
        <el-radio-button label="all">全部（{{ counts.all }}）</el-radio-button>
        <el-radio-button label="image">图片（{{ counts.image }}）</el-radio-button>
        <el-radio-button label="video">视频（{{ counts.video }}）</el-radio-button>
        <el-radio-button label="copy">文案（{{ counts.copy }}）</el-radio-button>
      </el-radio-group>
      <span class="total">共 {{ counts.all }} 条素材</span>
    </div>

    <el-empty v-if="!filtered.length" description="该类型暂无素材" />
    <div v-else class="grid">
      <el-card v-for="a in filtered" :key="a.id" class="cell" shadow="hover" body-class="cell-body">
        <el-image
          v-if="a.kind === 'image'"
          class="media"
          :src="mediaSrc(a.mediaUrl)"
          :preview-src-list="previewList"
          :initial-index="previewList.indexOf(mediaSrc(a.mediaUrl))"
          fit="cover"
          preview-teleported
        >
          <template #error>
            <div class="ph"><el-icon><Picture /></el-icon></div>
          </template>
        </el-image>

        <video
          v-else-if="a.kind === 'video'"
          class="media"
          :src="mediaSrc(a.mediaUrl)"
          controls
          width="240"
        ></video>

        <div v-else class="copy media">{{ a.content }}</div>

        <div class="caption">
          <div class="prod">{{ productLabel(a) }}</div>
          <div class="name">资产：{{ a.name || "未命名" }}</div>
        </div>
      </el-card>
    </div>
  </template>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 16px;
}
.total {
  color: #909399;
  font-size: 13px;
}
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.cell {
  width: 264px;
}
.cell :deep(.cell-body) {
  padding: 12px;
}
.media {
  width: 240px;
  height: 240px;
  border-radius: 8px;
  display: block;
  object-fit: cover;
  background: #f5f7fa;
}
.copy {
  height: 240px;
  padding: 10px 12px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  color: #303133;
  box-sizing: border-box;
}
.ph {
  width: 240px;
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #c0c4cc;
  background: #f5f7fa;
  border-radius: 8px;
}
.caption {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.5;
}
.prod {
  color: #303133;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.name {
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
