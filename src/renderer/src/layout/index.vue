<template>
  <div class="layout-container">
    <!-- 顶部导航栏 -->
    <LayoutHeader />

    <div class="layout-body">
      <!-- 主内容区 -->
      <div class="layout-main">
        <router-view v-slot="{ Component }">
          <keep-alive :include="cachedComponents">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LayoutHeader from './components/Header.vue'
const cachedComponents = ref(['Cloud', 'Automation'])
</script>

<style scoped>
.layout-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color-page);
}

.layout-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
}
</style>
