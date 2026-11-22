<script setup>
import { ref } from 'vue'

const width = ref(220)
const collapsed = ref(false)
</script>

<template>
  <DouSplitter
    v-model="width"
    v-model:collapsed="collapsed"
    unit="px"
    :min="160"
    :max="360"
    :min-end="200"
    collapsible
  >
    <template #start>
      <div class="pixel-pane">
        <div>项目边栏</div>
        <div class="pixel-meta">{{ collapsed ? '已折叠' : `${width}px` }}</div>
      </div>
    </template>
    <template #end>
      <div class="pixel-pane">
        <div>主内容区</div>
        <div class="pixel-meta">容器缩放时，左侧保持 {{ width }}px（自动扣除 1px 分隔线）</div>
      </div>
    </template>
  </DouSplitter>
</template>

<style scoped>
.pixel-pane {
  box-sizing: border-box;
  height: 100%;
  padding: 12px 16px;
  color: var(--dou-color-text-secondary);
  font-size: 13px;
}

.pixel-meta {
  margin-top: 6px;
  color: var(--dou-color-text-tertiary);
  font-size: 12px;
}
</style>
