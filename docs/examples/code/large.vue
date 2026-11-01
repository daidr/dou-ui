<script setup>
import { CodeText, DouCodeEditor, javascript } from '@dou-ui/code'
import { DouSegmentedControl, DouSpace, DouSwitch, DouText } from 'dou-ui'
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'

const size = shallowRef(100_000)
const minimap = shallowRef(true)

// 一段订单处理代码，按序号重复，直到凑够行数
const block = (i) => [
  `/** 第 ${i + 1} 组：按城市汇总订单 */`,
  `export function summarize${i}(orders, city = '上海') {`,
  `  const list = orders.filter((order) => order.city === city && order.total > ${i % 50})`,
  `  if (!list.length) return null`,
  `  let sum = 0`,
  `  for (const order of list) {`,
  `    sum += order.total // 金额以分为单位`,
  `  }`,
  `  return { city, count: list.length, sum, owner: '戴兜' }`,
  `}`,
  ``,
]
const make = (count) => {
  const lines = []
  for (let i = 0; lines.length < count; i++) lines.push(...block(i))
  lines.length = count
  return CodeText.of(lines)
}
const doc = shallowRef(make(size.value))
watch(size, (count) => (doc.value = make(count)))

// 小地图在编辑器窄于 480px 时不显示，这时开关也停用
const editor = useTemplateRef('editor')
const wide = shallowRef(true)
let observer
onMounted(() => {
  observer = new ResizeObserver(([entry]) => (wide.value = entry.contentRect.width >= 480))
  observer.observe(editor.value.$el)
})
onBeforeUnmount(() => observer?.disconnect())

const info = computed(
  () => `${doc.value.lines.toLocaleString()} 行，约 ${Math.round(doc.value.length / 1e6)} MB`,
)
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouSpace wrap align="center">
      <DouSegmentedControl
        v-model="size"
        size="sm"
        :options="[
          { label: '10 万行', value: 100_000 },
          { label: '100 万行', value: 1_000_000 },
        ]"
      />
      <DouSwitch v-model="minimap" :disabled="!wide">小地图</DouSwitch>
      <DouText v-if="!wide" variant="secondary" size="sm">编辑器较窄，不显示小地图</DouText>
    </DouSpace>
    <DouCodeEditor
      ref="editor"
      v-model:doc="doc"
      :language="javascript"
      worker
      :minimap="minimap"
      style="height: 400px"
      aria-label="大文件示例"
    />
    <DouText variant="secondary" size="sm">{{ info }}</DouText>
  </DouSpace>
</template>
