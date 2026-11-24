<script setup>
import { markRaw, ref } from 'vue'
import { FileTextIcon } from '@dou-ui/icons'

const fileIcon = markRaw(FileTextIcon)

const items = ref([
  { value: 'overview', label: '概览', closable: false },
  {
    value: 'review',
    label: '上海前端基础设施架构评审与排期说明',
    icon: fileIcon,
    closable: true,
  },
  {
    value: 'notes',
    label: '戴兜整理的多标签分栏工作区交互验收记录',
    icon: fileIcon,
    closable: true,
  },
  { value: 'deploy', label: '部署', closable: true },
])

const active = ref('review')

function onRemove(value) {
  const index = items.value.findIndex((item) => item.value === value)
  if (index < 0) return
  items.value.splice(index, 1)
  if (active.value === value) {
    active.value = items.value[Math.min(index, items.value.length - 1)]?.value
  }
}
</script>

<template>
  <DouTabs v-model="active" class="truncate-tabs" closable @remove="onRemove">
    <DouTabPanel
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      :label="item.label"
      :icon="item.icon"
      :closable="item.closable"
    >
      {{
        item.label
      }}的内容。将指针停在被截断的标签标题上，会通过原生提示显示完整标题；未截断的标签不会附加提示。
    </DouTabPanel>
  </DouTabs>
</template>

<style scoped>
.truncate-tabs {
  --dou-tabs-tab-max-width: 14em;
}
</style>
