<script setup lang="ts">
import { DouEditor, starterKit, type PartialBlock } from '@dou-ui/editor'
import { ref } from 'vue'

const extensions = [starterKit()]

const blocks = ref<PartialBlock[]>([
  { type: 'heading', props: { level: 2 }, content: '上海门店周报' },
  {
    type: 'table',
    props: {
      columns: [
        { id: 'store', width: 140 },
        { id: 'week' },
        { id: 'sales', align: 'right' },
        { id: 'owner' },
      ],
    },
    rows: [
      { cells: ['门店', '日期', '销售额', '负责人'] },
      { cells: [{ content: '静安店', rowspan: 2 }, '周一', '12,400', '戴兜'] },
      { cells: ['', '周二', '9,860', '阿青'] },
      { cells: [{ content: '徐汇店', rowspan: 2 }, '周一', '8,320', '陆敏'] },
      { cells: ['', '周二', '10,150', '陆敏'] },
      { cells: [{ content: '合计', colspan: 2 }, '', '40,730', ''] },
    ],
  },
  { content: '' },
])
</script>

<template>
  <DouEditor v-model="blocks" :extensions="extensions" label="门店周报" />
</template>
