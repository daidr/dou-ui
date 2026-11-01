<script setup>
import { DouChart, DouChartBar, DouChartLine, DouChartMarker } from '@dou-ui/chart'
import { DouButton, DouSpace, downloadBlob } from 'dou-ui'
import { useTemplateRef } from 'vue'

const rows = [
  { quarter: '第一季度', income: 320, cost: 210 },
  { quarter: '第二季度', income: 410, cost: 260 },
  { quarter: '第三季度', income: 380, cost: 250 },
  { quarter: '第四季度', income: 470, cost: 290 },
]

const chart = useTemplateRef('chart')

async function savePNG() {
  if (chart.value) downloadBlob(await chart.value.exportPNG(), '季度收支.png')
}
function saveSVG() {
  if (!chart.value) return
  downloadBlob(new Blob([chart.value.exportSVG()], { type: 'image/svg+xml' }), '季度收支.svg')
}
</script>

<template>
  <DouSpace>
    <DouButton size="sm" @click="savePNG">导出 PNG</DouButton>
    <DouButton size="sm" @click="saveSVG">导出 SVG</DouButton>
  </DouSpace>
  <DouChart ref="chart" :data="rows" x="quarter" :height="280" style="margin-top: 12px">
    <DouChartBar y="income" name="收入" />
    <DouChartLine y="cost" name="成本" />
    <DouChartMarker :y="400" label="收入目标" tone="primary" />
  </DouChart>
</template>
