<script setup lang="ts">
import { DouEditor, starterKit, type Block } from '@dou-ui/editor'
import { markdownToBlocks } from '@dou-ui/editor/markdown'
import { onMounted, ref } from 'vue'

const extensions = [starterKit()]

const markdown = ref(`## 读书笔记

> [!NOTE]
> 只摘录觉得有用的部分。

- 第一章：**先写清楚问题**
  - 问题写清楚，答案就有了一半
- 第二章：少用形容词

<details>
<summary>原文摘录</summary>

好的文字是删出来的。

</details>
`)

const blocks = ref<Block[]>([])

// 读取 Markdown 需要浏览器的 DOMParser，所以在挂载后进行
function load() {
  blocks.value = markdownToBlocks(markdown.value, extensions)
}
onMounted(load)
</script>

<template>
  <DouTextarea v-model="markdown" :rows="8" />
  <DouButton style="align-self: flex-start" @click="load">导入</DouButton>
  <DouEditor v-model="blocks" :extensions="extensions" aria-label="读书笔记" />
</template>
