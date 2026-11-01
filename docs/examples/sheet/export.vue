<script setup>
import { DownloadIcon, PrinterIcon } from '@dou-ui/icons'
import { DouSheet } from '@dou-ui/sheet'
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'

const head = (value) => ({ value, style: 'head' })
const money = (value) => ({ value, format: '¥#,##0' })
const status = (value) => ({ value, type: 'status' })

const book = ref({
  styles: { head: { bold: true, fill: 'neutral' }, title: { bold: true, align: 'center' } },
  types: {
    status: {
      type: 'select',
      options: [
        { value: '已完成', tone: 'success' },
        { value: '进行中', tone: 'primary' },
        '未开始',
      ],
    },
  },
  sheets: [
    {
      name: '门店',
      freeze: { rows: 2 },
      colSizes: { 0: 104, 1: 104, 2: 104, 3: 88, 4: 88, 5: 64 },
      merges: ['A1:F1'],
      cells: [
        [{ value: '十月门店销售', style: 'title' }],
        [head('门店'), head('销售额'), head('目标'), head('完成率'), head('盘点'), head('复核')],
        ...[
          ['上海静安', 196800, 180000, '已完成', true],
          ['上海徐汇', 162900, 170000, '进行中', false],
          ['上海浦东', 148200, 150000, '未开始', false],
          ['上海长宁', 121500, 110000, '已完成', true],
        ].map(([store, sales, goal, state, checked], i) => [
          store,
          money(sales),
          money(goal),
          { value: `=B${i + 3}/C${i + 3}`, format: '0.0%' },
          status(state),
          { value: checked, type: 'checkbox' },
        ]),
        [head('合计'), { value: '=SUM(B3:B6)', format: '¥#,##0', style: 'head' }],
      ],
      conditionalFormats: [{ range: 'B3:B6', bar: 'primary' }],
    },
  ],
})

const grid = useTemplateRef('grid')
const preview = ref('')

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function exportPNG() {
  const blob = await grid.value.toPNG()
  URL.revokeObjectURL(preview.value)
  preview.value = URL.createObjectURL(blob)
  download(blob, '门店.png')
}

function exportSVG() {
  const svg = grid.value.toSVG()
  download(new Blob([svg], { type: 'image/svg+xml' }), '门店.svg')
}

onBeforeUnmount(() => URL.revokeObjectURL(preview.value))
</script>

<template>
  <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px">
    <DouButton variant="outline" @click="exportPNG">
      <template #leading><DownloadIcon /></template>
      导出 PNG
    </DouButton>
    <DouButton variant="outline" @click="exportSVG">
      <template #leading><DownloadIcon /></template>
      导出 SVG
    </DouButton>
    <DouButton variant="outline" @click="grid.print({ title: '销售报表 · 2026 年 10 月' })">
      <template #leading><PrinterIcon /></template>
      打印
    </DouButton>
  </div>
  <DouSheet ref="grid" v-model="book" style="height: 260px" />
  <img
    v-if="preview"
    :src="preview"
    alt="导出的图片"
    style="display: block; max-width: 100%; margin-top: 12px; border-radius: 6px"
    width="552"
  />
</template>
