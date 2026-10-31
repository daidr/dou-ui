<script setup>
import { ref } from 'vue'
import { CursorIcon, MoveIcon, PencilIcon, SquareIcon, TypeIcon } from '@dou-ui/icons'

const tool = ref('select')
</script>

<template>
  <DouToolbar orientation="vertical" aria-label="画布工具">
    <DouToggleGroup v-model="tool" orientation="vertical" aria-label="工具">
      <DouToggle value="select" aria-label="选择"><CursorIcon /></DouToggle>
      <DouToggle value="hand" aria-label="平移"><MoveIcon /></DouToggle>
    </DouToggleGroup>
    <DouToolbarSeparator />
    <DouToggleGroup v-model="tool" orientation="vertical" aria-label="绘制">
      <DouToggle value="pen" aria-label="画笔"><PencilIcon /></DouToggle>
      <DouToggle value="rect" aria-label="矩形"><SquareIcon /></DouToggle>
      <DouToggle value="text" aria-label="文字"><TypeIcon /></DouToggle>
    </DouToggleGroup>
  </DouToolbar>
</template>
