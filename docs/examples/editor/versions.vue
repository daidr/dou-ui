<script setup lang="ts">
import { DouEditor, type Block, type EditorDocument } from '@dou-ui/editor'
import { DouButton, DouSegmentedControl } from 'dou-ui'
import { computed, ref, useTemplateRef } from 'vue'

interface Version {
  id: string
  name: string
  doc: EditorDocument
}

const paragraph = (id: string, text: string): Block => ({
  id,
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text }],
  children: [],
})

// 应用自己保存的版本，这里写死两份
const versions: Version[] = [
  {
    id: 'v1',
    name: '初稿',
    doc: {
      version: 1,
      blocks: [
        { ...paragraph('title', '上海门店开业方案'), type: 'heading', props: { level: 2 } },
        paragraph('date', '新店计划在十一月最后一个周末开业。'),
        paragraph('gift', '前五十位顾客赠送帆布袋。'),
        paragraph('staff', '店员从总店抽调两人。'),
      ],
    },
  },
  {
    id: 'v2',
    name: '评审后',
    doc: {
      version: 1,
      blocks: [
        { ...paragraph('title', '上海门店开业方案'), type: 'heading', props: { level: 2 } },
        paragraph('date', '新店计划在十二月第一个周末开业。'),
        paragraph('gift', '前一百位顾客赠送帆布袋。'),
        paragraph('price', '开业当天全场八折。'),
      ],
    },
  },
]

const doc = ref<EditorDocument>(structuredClone(versions[1]!.doc))
doc.value.blocks[1] = paragraph('date', '新店计划在十二月第一个周末开业，当天下午有乐队演出。')

const shown = ref('now')
const editor = useTemplateRef<InstanceType<typeof DouEditor>>('editor')
const compare = computed(() => versions.find((v) => v.id === shown.value)?.doc ?? null)

const options = [
  { label: '当前', value: 'now' },
  ...versions.map((v) => ({ label: `对比“${v.name}”`, value: v.id })),
]

function restore() {
  if (!compare.value) return
  // 恢复前可以先把当前内容存成一个版本
  editor.value?.restore(compare.value)
  shown.value = 'now'
}
</script>

<template>
  <div class="versions-demo">
    <div class="versions-demo__bar">
      <DouSegmentedControl v-model="shown" :options="options" size="sm" />
      <template v-if="compare">
        <DouButton size="sm" variant="outline" @click="editor?.previousChange()">上一处</DouButton>
        <DouButton size="sm" variant="outline" @click="editor?.nextChange()">下一处</DouButton>
        <DouButton size="sm" variant="solid" tone="primary" @click="restore">恢复此版本</DouButton>
      </template>
    </div>
    <DouEditor ref="editor" v-model="doc" :compare="compare" aria-label="开业方案" />
  </div>
</template>

<style scoped>
.versions-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.versions-demo__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
