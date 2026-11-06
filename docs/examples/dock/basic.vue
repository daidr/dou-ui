<script setup>
import { ref } from 'vue'

const panels = [
  { value: 'thread', label: '需求讨论' },
  { value: 'plan', label: '发布计划' },
  { value: 'api', label: '接口文档' },
  { value: 'log', label: '构建日志' },
  { value: 'notes', label: '会议纪要' },
]

const layout = ref({
  type: 'split',
  direction: 'horizontal',
  size: 55,
  start: { type: 'group', id: 'main', tabs: ['thread', 'plan', 'notes'] },
  end: {
    type: 'split',
    direction: 'vertical',
    start: { type: 'group', id: 'side', tabs: ['api'] },
    end: { type: 'group', id: 'bottom', tabs: ['log'] },
  },
})
</script>

<template>
  <DouDock v-model="layout" :panels="panels">
    <template #default="{ value }">
      <p>{{ panels.find((panel) => panel.value === value).label }}的内容。</p>
      <p>
        把标签拖到另一组的标签行里移过去，拖到一组内容区的边缘拆出新的一组，拖到中间放进这一组。
      </p>
    </template>
  </DouDock>
</template>

<style scoped>
p {
  margin: 0 0 8px;
}
</style>
