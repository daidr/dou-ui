<script setup>
import { ref } from 'vue'
import {
  BoldIcon,
  ItalicIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  UnderlineIcon,
} from '@dou-ui/icons'

const align = ref('left')
const marks = ref(['bold'])
</script>

<template>
  <DouToggleGroup v-model="align" aria-label="对齐方式">
    <DouToggle value="left" aria-label="左对齐"><TextAlignLeftIcon /></DouToggle>
    <DouToggle value="center" aria-label="居中"><TextAlignCenterIcon /></DouToggle>
    <DouToggle value="right" aria-label="右对齐"><TextAlignRightIcon /></DouToggle>
  </DouToggleGroup>
  <DouToggleGroup v-model="marks" type="multiple" variant="outline" aria-label="文字样式">
    <DouToggle value="bold" aria-label="加粗"><BoldIcon /></DouToggle>
    <DouToggle value="italic" aria-label="斜体"><ItalicIcon /></DouToggle>
    <DouToggle value="underline" aria-label="下划线"><UnderlineIcon /></DouToggle>
  </DouToggleGroup>
  <DouText variant="tertiary" size="sm" mono>{{ align }} · {{ marks }}</DouText>
</template>
