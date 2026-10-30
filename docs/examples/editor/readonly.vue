<script setup>
import { DouEditor } from '@dou-ui/editor'
import { ref } from 'vue'

const readonly = ref(true)
const blocks = ref([
  { type: 'heading', props: { level: 2 }, content: '周会纪要' },
  {
    content: [
      { type: 'text', text: '记录人：戴兜。会议资料见' },
      { type: 'text', text: '项目文档', link: 'https://ui.daidr.me' },
      { type: 'text', text: '。' },
    ],
  },
  { type: 'checkItem', props: { checked: true }, content: '确认上海办公室的搬迁日期' },
  { type: 'checkItem', content: '整理新同事的入职清单' },
])
</script>

<template>
  <DouSwitch v-model="readonly">只读</DouSwitch>
  <DouEditor v-model="blocks" :readonly="readonly" label="周会纪要" />
</template>
