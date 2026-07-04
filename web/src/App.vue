<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "./api";

const route = useRoute();
// 商品详情归到「商品·工作流」菜单高亮
const activeMenu = computed(() =>
  route.path.startsWith("/products") ? "/products" : route.path
);

// 审核中心待办数徽标(每 60 秒静默刷新,失败忽略)
const reviewCount = ref(0);
let reviewTimer: ReturnType<typeof setInterval> | undefined;
async function refreshReviewCount() {
  try {
    const q = await api.getReviewQueue();
    reviewCount.value = q.counts.pending + q.counts.failed;
  } catch {}
}
onMounted(() => {
  refreshReviewCount();
  reviewTimer = setInterval(refreshReviewCount, 60_000);
});
onUnmounted(() => {
  if (reviewTimer) clearInterval(reviewTimer);
});
</script>

<template>
  <el-container style="height: 100vh">
    <el-aside width="220px" class="aside">
      <div class="brand">云营系统 <small>AI 电商自动运营</small></div>
      <el-menu :default-active="activeMenu" router>
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <span>今日工作台</span>
        </el-menu-item>
        <el-menu-item index="/launch">
          <el-icon><Promotion /></el-icon>
          <span>工作流启动</span>
        </el-menu-item>
        <el-menu-item index="/review">
          <el-icon><BellFilled /></el-icon>
          <span>审核中心</span>
          <el-badge :value="reviewCount" :hidden="!reviewCount" style="margin-left: 6px" />
        </el-menu-item>
        <el-menu-item index="/products">
          <el-icon><Goods /></el-icon>
          <span>商品 · 工作流</span>
        </el-menu-item>
        <el-menu-item index="/inventory">
          <el-icon><Box /></el-icon>
          <span>库存管理</span>
        </el-menu-item>
        <el-menu-item index="/assets">
          <el-icon><PictureFilled /></el-icon>
          <span>素材库</span>
        </el-menu-item>
        <el-menu-item index="/models">
          <el-icon><Avatar /></el-icon>
          <span>模特图库</span>
        </el-menu-item>
        <el-menu-item index="/reference-videos">
          <el-icon><VideoCamera /></el-icon>
          <span>参考视频库</span>
        </el-menu-item>
        <el-menu-item index="/accounts">
          <el-icon><User /></el-icon>
          <span>平台账号</span>
        </el-menu-item>
        <el-menu-item index="/credentials">
          <el-icon><Key /></el-icon>
          <span>平台凭证</span>
        </el-menu-item>
      </el-menu>
      <div class="source-tag">v0.9 内测版</div>
    </el-aside>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>
