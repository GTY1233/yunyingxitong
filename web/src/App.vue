<script setup lang="ts">
import { useRoute } from "vue-router";
const route = useRoute();
</script>

<template>
  <el-container style="height: 100vh">
    <el-aside width="220px" class="aside">
      <div class="brand">云营系统 <small>新架构预览（阶段二/四）</small></div>
      <el-menu :default-active="route.path" router>
        <el-menu-item index="/products">
          <el-icon><Goods /></el-icon>
          <span>商品 · 工作流</span>
        </el-menu-item>
      </el-menu>
      <div class="source-tag">数据源：Fastify /api/v2 ← SQLite</div>
    </el-aside>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>
