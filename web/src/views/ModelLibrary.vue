<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, ref } from "vue";
import { type ModelImage, api } from "../api";

const models = ref<ModelImage[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    models.value = await api.listModelImages();
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function customUpload(opt: any) {
  try {
    await api.uploadModelImage(opt.file as File);
    ElMessage.success("模特图已上传");
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function remove(id: string) {
  try {
    await api.deleteModelImage(id);
    ElMessage.success("已删除");
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

function src(u?: string) {
  return !u ? "" : u.startsWith("http") ? u : `/${u}`;
}
</script>

<template>
  <h2>模特图库</h2>
  <p class="hint">
    换装生图时，这里的「模特图」作为人物（node41），商品详情页的「服装图」作为衣服（node79），生成模特穿上该服装的图。
  </p>

  <el-skeleton v-if="loading" :rows="3" animated />
  <div v-else class="grid">
    <div v-for="m in models" :key="m.id" class="cell">
      <el-image
        :src="src(m.mediaUrl)"
        fit="cover"
        style="width: 160px; height: 160px; border-radius: 8px"
        :preview-src-list="[src(m.mediaUrl)]"
      />
      <el-button class="del" size="small" text type="danger" @click="remove(m.id)">删除</el-button>
    </div>
    <el-upload
      class="uploader"
      :http-request="customUpload"
      :show-file-list="false"
      accept="image/png,image/jpeg,image/webp,image/gif"
      drag
    >
      <div class="up">
        <el-icon :size="22"><Upload /></el-icon>
        <div>上传模特图</div>
      </div>
    </el-upload>
  </div>
</template>

<style scoped>
.hint {
  color: #94a3b8;
  font-size: 13px;
  margin: 0 0 16px;
}
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.cell {
  width: 160px;
}
.uploader :deep(.el-upload-dragger) {
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.up {
  color: #94a3b8;
  text-align: center;
  font-size: 13px;
}
</style>
