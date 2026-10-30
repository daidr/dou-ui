<script setup>
import { useElementSize } from 'dou-ui'
import { useTemplateRef } from 'vue'

const box = useTemplateRef('box')
const { width, height } = useElementSize(box)
</script>

<template>
  <div ref="box" class="box">
    <DouText variant="secondary" mono>{{ Math.round(width) }} × {{ Math.round(height) }}</DouText>
    <DouText variant="tertiary" size="sm">拖动右下角调整大小</DouText>
  </div>
</template>

<style scoped>
.box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-sizing: border-box;
  width: 240px;
  min-width: 120px;
  max-width: 100%;
  height: 120px;
  min-height: 80px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  overflow: hidden;
  resize: both;
}
</style>
