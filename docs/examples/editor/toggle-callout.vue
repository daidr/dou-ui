<script setup lang="ts">
import { DouEditor, type EditorDocument, type PartialBlock } from '@dou-ui/editor'
import { ref } from 'vue'

const doc = ref<EditorDocument<PartialBlock>>({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '上海周末出行须知' },
    { type: 'callout', props: { tone: 'tip' }, content: '工作日上午人少，适合慢慢逛展。' },
    {
      type: 'callout',
      props: { tone: 'warning' },
      content: '博物馆需要提前一天预约，现场不能补约。',
    },
    {
      type: 'toggle',
      content: '要带的东西',
      children: [
        { type: 'checkItem', content: '交通卡' },
        { type: 'checkItem', content: '充电宝' },
        { type: 'checkItem', props: { checked: true }, content: '雨伞' },
      ],
    },
    {
      type: 'toggle',
      content: '戴兜推荐的路线',
      children: [
        { type: 'numberedItem', content: '上午：上海博物馆东馆' },
        { type: 'numberedItem', content: '中午：附近吃面' },
        { type: 'numberedItem', content: '下午：沿世纪大道散步' },
      ],
    },
    { type: 'paragraph', content: '' },
  ],
})
</script>

<template>
  <DouEditor v-model="doc" aria-label="出行须知" />
</template>
