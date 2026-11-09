<script setup lang="ts">
defineProps<{ data: { text?: string } }>()
</script>

<template>
  <!-- ports: 'sides' 的端口自带显示时机，这里不用放端口 -->
  <div class="pending-node">{{ data.text || '待定' }}</div>
</template>

<style scoped>
.pending-node {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 8px 12px;
  border: 1px dashed var(--dou-color-border-strong);
  border-radius: var(--dou-radius-control);
  color: var(--dou-color-text-tertiary);
}
</style>
