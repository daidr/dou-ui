<script setup lang="ts">
import { DouEditor, mention, editorKit, type MentionItem } from '@dou-ui/editor'
import { ref } from 'vue'

const people: MentionItem[] = [
  { id: 'daidr', label: '戴兜', description: '上海 · 设计' },
  { id: 'aqing', label: '阿青', description: '上海 · 前端' },
  { id: 'lumin', label: '陆敏', description: '上海 · 产品' },
  { id: 'xuyang', label: '许阳', description: '杭州 · 后端' },
  { id: 'zhouyi', label: '周一', description: '杭州 · 测试' },
]

// 示例里在本地筛选，实际使用时可以请求接口
async function search(query: string) {
  await new Promise((resolve) => setTimeout(resolve, 200))
  const text = query.toLowerCase()
  return people.filter((person) => person.label.includes(query) || person.id.includes(text))
}

const extensions = [editorKit(), mention({ search })]

const doc = ref({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '首页改版评审' },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '视觉稿已更新，请 ' },
        { type: 'inline', name: 'mention', props: { id: 'aqing', label: '阿青' } },
        { type: 'text', text: ' 周四前确认实现难度。' },
      ],
    },
    { type: 'paragraph', content: '' },
  ],
})
</script>

<template>
  <DouEditor v-model="doc" :extensions="extensions" aria-label="评审记录" />
</template>
