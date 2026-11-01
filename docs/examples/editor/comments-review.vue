<script setup lang="ts">
import { DouEditor, type EditorDocument, type PartialBlock } from '@dou-ui/editor'
import type { CommentThread } from 'dou-ui'
import { ref } from 'vue'

const doc: EditorDocument<PartialBlock> = {
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '季度复盘' },
    {
      content:
        '本季度新增会员一千二百人，复购率比上季度提高了五个百分点。线上订单占比首次超过一半，主要来自小程序。',
    },
    { type: 'bulletItem', content: '门店客流下降，需要结合周边施工的影响一起看。' },
    { type: 'bulletItem', content: '下季度重点：会员日活动和新品试吃。' },
  ],
}
const threads = ref<CommentThread[]>([])
</script>

<template>
  <DouEditor
    :model-value="doc"
    v-model:comments="threads"
    readonly
    :author="{ id: 'qing', name: '阿青' }"
    aria-label="季度复盘"
  />
</template>
