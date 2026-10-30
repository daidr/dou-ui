<script setup lang="ts">
import { defineBlock, DouEditor, starterKit } from '@dou-ui/editor'
import { CheckCircleIcon } from '@dou-ui/icons'
import { ref } from 'vue'
import DecisionBlock from './decision-block.vue'

const decision = defineBlock({
  type: 'decision',
  props: { state: 'open' },
  component: DecisionBlock,
  menu: {
    label: '决定',
    hint: '记录一项决定和它的状态',
    icon: CheckCircleIcon,
    keywords: ['decision', 'jd', 'jueding'],
  },
})

const extensions = [starterKit(), decision]

const blocks = ref([
  { type: 'heading', props: { level: 2 }, content: '周末出游会议' },
  { type: 'paragraph', content: '戴兜记录，点击状态可以切换。' },
  { type: 'decision', props: { state: 'yes' }, content: '周六上午去上海博物馆东馆。' },
  { type: 'decision', props: { state: 'open' }, content: '周日是否去崇明，看天气再定。' },
  { type: 'decision', props: { state: 'no' }, content: '不自驾，全程坐地铁。' },
  { type: 'paragraph', content: '' },
])
</script>

<template>
  <DouEditor v-model="blocks" :extensions="extensions" aria-label="会议记录" />
</template>
