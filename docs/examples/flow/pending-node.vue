<script setup lang="ts">
import { DouFlowPort } from '@dou-ui/flow'

defineProps<{ data: { text?: string } }>()

const sides = ['top', 'right', 'bottom', 'left'] as const
</script>

<template>
  <div class="pending-node">
    {{ data.text || '待定' }}
    <!-- 和内置形状一样：起点悬停时出现，终点只在拉线经过时出现 -->
    <template v-for="side in sides" :key="side">
      <DouFlowPort :id="`${side}-in`" visible="connecting" />
      <DouFlowPort :id="side" visible="hover" />
    </template>
  </div>
</template>

<style scoped>
.pending-node {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 8px 12px;
  border: 1px dashed var(--dou-color-border-strong);
  border-radius: var(--dou-radius-md);
  color: var(--dou-color-text-tertiary);
}
</style>
