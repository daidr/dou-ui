<script setup lang="ts">
import { DouEditor, editorKit, type PartialBlock, type EditorDocument } from '@dou-ui/editor'
import { ref } from 'vue'

const extensions = [editorKit()]

const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const doc = ref<EditorDocument<PartialBlock>>({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '上海门店日销售额' },
    { content: '表格比正文宽时，先伸进右侧的空白，再左右滚动查看。' },
    {
      type: 'table',
      props: {
        columns: [{ id: 'store', width: 120 }, ...days.map((day) => ({ id: day, width: 120 }))],
      },
      rows: [
        { cells: ['门店', ...days] },
        { cells: ['静安店', '12,400', '9,860', '11,200', '10,730', '14,980', '18,320', '16,040'] },
        { cells: ['徐汇店', '8,320', '10,150', '9,410', '8,870', '12,060', '15,700', '13,920'] },
        { cells: ['浦东店', '10,980', '11,240', '10,060', '9,950', '13,410', '17,160', '15,280'] },
      ],
    },
    { content: '正文仍在阅读宽度内换行。' },
  ],
})
</script>

<template>
  <DouEditor
    v-model="doc"
    :extensions="extensions"
    aria-label="门店日销售额"
    :style="{ '--dou-editor-reading-width': '20em' }"
  />
</template>
