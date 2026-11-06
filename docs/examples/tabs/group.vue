<script setup>
import { reactive } from 'vue'

const lists = reactive({
  left: {
    active: 'plan',
    tabs: [
      { value: 'plan', label: '发布计划' },
      { value: 'notes', label: '会议纪要' },
    ],
  },
  right: {
    active: 'api',
    tabs: [
      { value: 'api', label: '接口文档' },
      { value: 'log', label: '构建日志' },
    ],
  },
})

function move({ value, from, to }) {
  const source = lists[from.name]
  const target = lists[to.name]
  const [tab] = source.tabs.splice(from.index, 1)
  target.tabs.splice(to.index, 0, tab)
  // the tab that left was selected there: select its neighbour
  if (source !== target && source.active === value)
    source.active = source.tabs[Math.max(0, from.index - 1)]?.value
}
</script>

<template>
  <div class="demo-tab-groups">
    <DouTabs
      v-for="(list, name) in lists"
      :key="name"
      v-model="list.active"
      :name="name"
      group="docs"
      draggable
      @move="move"
    >
      <DouTabPanel v-for="tab in list.tabs" :key="tab.value" :value="tab.value" :label="tab.label">
        {{ tab.label }}
      </DouTabPanel>
    </DouTabs>
  </div>
</template>

<style scoped>
.demo-tab-groups {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
</style>
