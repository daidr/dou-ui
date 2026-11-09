<script setup lang="ts">
import { DouEditor, type EditorDocument, type PartialBlock } from '@dou-ui/editor'
import { DouSwitch } from 'dou-ui'
import { ref } from 'vue'

/** A narrow editor, as on a phone: the columns stack. */
const narrow = ref(false)

const doc = ref<EditorDocument<PartialBlock>>({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '上海两日行程' },
    {
      type: 'columns',
      children: [
        {
          type: 'column',
          // twice as wide as the other column
          props: { width: 2 },
          children: [
            { type: 'heading', props: { level: 3 }, content: '周六' },
            { type: 'bulletItem', content: '上午：上海博物馆东馆' },
            { type: 'bulletItem', content: '下午：沿世纪大道散步' },
          ],
        },
        {
          type: 'column',
          children: [
            { type: 'heading', props: { level: 3 }, content: '周日' },
            { type: 'bulletItem', content: '上午：滨江骑行' },
            { type: 'bulletItem', content: '下午：回家整理照片' },
          ],
        },
      ],
    },
    { type: 'callout', props: { tone: 'tip' }, content: '戴兜：周日下午可能下雨，记得带伞。' },
    { type: 'paragraph', content: '' },
  ],
})
</script>

<template>
  <DouSwitch v-model="narrow">窄屏</DouSwitch>
  <DouEditor
    v-model="doc"
    aria-label="行程安排"
    :style="narrow ? { maxWidth: '400px' } : undefined"
  />
</template>
