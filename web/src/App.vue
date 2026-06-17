<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
// 商品详情归到「商品·工作流」菜单高亮
const activeMenu = computed(() =>
  route.path.startsWith("/products") ? "/products" : route.path
);
</script>

<template>
  <el-container style="height: 100vh">
    <el-aside width="220px" class="aside">
      <div class="brand">云营系统 <small>新架构预览（阶段二/四）</small></div>
      <el-menu :default-active="activeMenu" router>
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <span>今日工作台</span>
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
        <el-menu-item index="/accounts">
          <el-icon><User /></el-icon>
          <span>平台账号</span>
        </el-menu-item>
      </el-menu>
      <div class="source-tag">数据源：Fastify /api/v2 ← SQLite</div>
    </el-aside>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>
