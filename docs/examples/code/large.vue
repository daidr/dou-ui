<script setup>
import { CodeText, DouCodeEditor, javascript } from '@dou-ui/code'
import { DouSegmentedControl, DouSpace, DouSwitch, DouText } from 'dou-ui'
import { computed, shallowRef, watch } from 'vue'

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

// 读颜色的 worker，所有编辑器共用一个；在浏览器里才创建
const worker =
  typeof Worker === 'undefined'
    ? null
    : new Worker(new URL('./worker/highlight.ts', import.meta.url), { type: 'module' })

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
      <DouSwitch v-model="minimap">小地图</DouSwitch>
    </DouSpace>
    <DouCodeEditor
      v-model:doc="doc"
      :language="javascript"
      :worker="worker"
      :minimap="minimap"
      style="height: 400px"
      aria-label="大文件示例"
    />
    <DouText variant="secondary" size="sm">{{ info }}</DouText>
  </DouSpace>
</template>
