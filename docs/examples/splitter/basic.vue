<script setup>
import { ref } from 'vue'

const size = ref(30)
const collapsed = ref(false)
</script>

<template>
  <DouSplitter v-model="size" :min="15" min-end="240px" collapsible v-model:collapsed="collapsed">
    <template #start>
      <div class="split-pane">文件列表 · {{ size }}%</div>
    </template>
    <template #end>
      <DouSplitter direction="vertical" :model-value="65">
        <template #start>
          <div class="split-pane">编辑器</div>
        </template>
        <template #end>
          <div class="split-pane">终端</div>
        </template>
      </DouSplitter>
    </template>
  </DouSplitter>
</template>

<style>
.split-pane {
  box-sizing: border-box;
  height: 100%;
  padding: 12px 16px;
  color: var(--dou-color-text-secondary);
  font-size: 13px;
}
</style>
