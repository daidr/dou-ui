<script setup>
import { ref } from 'vue'
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  RedoIcon,
  StrikethroughIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  UndoIcon,
} from '@dou-ui/icons'

const marks = ref(['bold'])
const align = ref('left')
const list = ref(null)
const heading = ref('p')
</script>

<template>
  <div class="editor-toolbar">
    <DouToolbar size="sm" aria-label="文本格式">
      <DouButton variant="ghost" aria-label="撤销"><UndoIcon /></DouButton>
      <DouButton variant="ghost" aria-label="重做"><RedoIcon /></DouButton>
      <DouToolbarSeparator />
      <DouSelect
        v-model="heading"
        style="width: 96px"
        aria-label="段落样式"
        :options="[
          { value: 'p', label: '正文' },
          { value: 'h1', label: '标题 1' },
          { value: 'h2', label: '标题 2' },
        ]"
      />
      <DouToolbarSeparator />
      <DouToggleGroup v-model="marks" type="multiple" aria-label="文字样式">
        <DouToggle value="bold" aria-label="加粗"><BoldIcon /></DouToggle>
        <DouToggle value="italic" aria-label="斜体"><ItalicIcon /></DouToggle>
        <DouToggle value="strike" aria-label="删除线"><StrikethroughIcon /></DouToggle>
      </DouToggleGroup>
      <DouToolbarSeparator />
      <DouToggleGroup v-model="align" aria-label="对齐方式">
        <DouToggle value="left" aria-label="左对齐"><TextAlignLeftIcon /></DouToggle>
        <DouToggle value="center" aria-label="居中"><TextAlignCenterIcon /></DouToggle>
        <DouToggle value="right" aria-label="右对齐"><TextAlignRightIcon /></DouToggle>
      </DouToggleGroup>
      <DouToolbarSeparator />
      <DouToggleGroup v-model="list" aria-label="列表">
        <DouToggle value="bullet" aria-label="无序列表"><ListIcon /></DouToggle>
        <DouToggle value="ordered" aria-label="有序列表"><ListOrderedIcon /></DouToggle>
      </DouToggleGroup>
      <DouButton variant="ghost" aria-label="插入链接"><LinkIcon /></DouButton>
    </DouToolbar>
  </div>
</template>

<style scoped>
.editor-toolbar {
  width: 100%;
  box-sizing: border-box;
  padding: 6px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-surface);
}
</style>
