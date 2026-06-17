<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, ref } from "vue";
import { type ReferenceVideo, api } from "../api";

const videos = ref<ReferenceVideo[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    videos.value = await api.listReferenceVideos();
  } catch (e) {
    ElMessage.error((e as Error).message);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function customUpload(opt: any) {
  try {
    await api.uploadReferenceVideo(opt.file as File);
    ElMessage.success("参考视频已上传");
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message);
  }
}

async function remove(id: string) {
  try {
    await api.deleteReferenceVideo(id);
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
  <h2>参考视频库</h2>
  <p class="hint">
    生视频时，这里的参考视频作为「动作模板」（node161），把最新生成的换装图按它的动作/节奏动起来。
  </p>

  <el-skeleton v-if="loading" :rows="3" animated />
  <div v-else class="grid">
    <div v-for="v in videos" :key="v.id" class="cell">
      <video :src="src(v.mediaUrl)" controls style="width: 180px; height: 200px; object-fit: cover; border-radius: 8px" />
      <div class="name">{{ v.name }}</div>
      <el-button class="del" size="small" text type="danger" @click="remove(v.id)">删除</el-button>
    </div>
    <el-upload
      class="uploader"
      :http-request="customUpload"
      :show-file-list="false"
      accept="video/mp4,video/quicktime,video/webm"
      drag
    >
      <div class="up">
        <el-icon :size="22"><Upload /></el-icon>
        <div>上传参考视频</div>
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
  align-items: flex-start;
}
.cell {
  width: 180px;
}
.name {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.uploader :deep(.el-upload-dragger) {
  width: 180px;
  height: 200px;
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
