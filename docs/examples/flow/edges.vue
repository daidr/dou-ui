<script setup lang="ts">
import { CameraIcon, FileTextIcon, ImageIcon, TextSearchIcon, UserIcon } from '@dou-ui/icons'
import { DouFlowControls, DouFlowEditor, type FlowDocument } from '@dou-ui/flow'
import { markRaw, ref } from 'vue'

const edgeType = ref('step')
const types = [
  { value: 'bezier', label: '曲线' },
  { value: 'step', label: '折线' },
  { value: 'straight', label: '直线' },
]

const doc = ref<FlowDocument>({
  version: 1,
  nodes: [
    {
      id: 'photo',
      x: 0,
      y: 64,
      width: 128,
      data: { label: '拍下书页', icon: markRaw(CameraIcon), outputs: [{ id: 'out' }] },
    },
    {
      id: 'ocr',
      x: 208,
      y: 64,
      data: {
        label: '识别文字',
        icon: markRaw(TextSearchIcon),
        status: 'process',
        inputs: [{ id: 'in' }],
        outputs: [
          { id: 'clear', label: '清晰' },
          { id: 'blurry', label: '模糊' },
        ],
      },
    },
    {
      id: 'note',
      x: 528,
      y: 0,
      data: { label: '整理成笔记', icon: markRaw(FileTextIcon), inputs: [{ id: 'in' }] },
    },
    {
      id: 'retake',
      x: 528,
      y: 168,
      data: { label: '请戴兜重拍', icon: markRaw(UserIcon), inputs: [{ id: 'in' }] },
    },
    {
      id: 'album',
      x: 208,
      y: 240,
      data: { label: '存进相册', icon: markRaw(ImageIcon), inputs: [{ id: 'in' }] },
    },
  ],
  edges: [
    {
      id: 'e1',
      source: { node: 'photo', port: 'out' },
      target: { node: 'ocr', port: 'in' },
      animated: true,
    },
    {
      id: 'e2',
      source: { node: 'ocr', port: 'clear' },
      target: { node: 'note', port: 'in' },
      label: '直接整理',
    },
    {
      id: 'e3',
      source: { node: 'ocr', port: 'blurry' },
      target: { node: 'retake', port: 'in' },
      label: '提醒重拍',
    },
    {
      id: 'e4',
      type: 'straight',
      source: { node: 'photo', port: 'out' },
      target: { node: 'album', port: 'in' },
    },
  ],
})
</script>

<template>
  <div class="edges-demo">
    <DouSegmentedControl v-model="edgeType" :options="types" size="sm" />
    <DouFlowEditor v-model="doc" :edge-type="edgeType" fit-view aria-label="整理读书笔记">
      <DouFlowControls />
    </DouFlowEditor>
  </div>
</template>

<style scoped>
.edges-demo {
  width: 100%;
  display: grid;
  gap: 12px;
  justify-items: start;
}
</style>
