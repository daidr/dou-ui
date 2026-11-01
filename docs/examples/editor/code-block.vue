<script setup lang="ts">
import { DouEditor, editorKit, type EditorDocument, type PartialBlock } from '@dou-ui/editor'
import { codeToHtml } from 'shiki'
import { ref } from 'vue'

const highlight = (code: string, lang: string) =>
  codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })

const extensions = [editorKit({ codeBlock: { highlight } })]

const doc = ref<EditorDocument<PartialBlock>>({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '读取行程' },
    { type: 'paragraph', content: '戴兜写的小工具，把上海周末的行程按日期排好。' },
    {
      type: 'codeBlock',
      props: { language: 'typescript' },
      content: `interface Stop {
  place: string
  date: string
}

export function byDate(stops: Stop[]) {
  return [...stops].sort((a, b) => a.date.localeCompare(b.date))
}`,
    },
    { type: 'paragraph', content: '' },
  ],
})
</script>

<template>
  <DouEditor v-model="doc" :extensions="extensions" aria-label="代码示例" />
</template>
