<script setup>
import { DouPivot } from '@dou-ui/pivot'
import { CopyIcon, DownloadIcon, PrinterIcon } from '@dou-ui/icons'
import { ref } from 'vue'
import { fields, orders } from './orders'

const config = ref({
  rows: ['region', 'city'],
  columns: ['quarter'],
  values: ['amount'],
})
const collapsed = ref({ rows: [['华南'], ['华北'], ['西南']] })
const pivot = ref()
const copied = ref(false)

async function copyAll() {
  await pivot.value.copy({ all: true })
  copied.value = true
  setTimeout(() => (copied.value = false), 1600)
}

function download() {
  const blob = new Blob([pivot.value.toCSV()], { type: 'text/csv' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = '销售额.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <div class="pivot-demo">
    <DouSpace wrap>
      <DouButton variant="outline" @click="copyAll">
        <template #leading><CopyIcon /></template>
        {{ copied ? '已复制' : '复制整张表' }}
      </DouButton>
      <DouButton variant="outline" @click="download">
        <template #leading><DownloadIcon /></template>
        下载 CSV
      </DouButton>
      <DouButton variant="outline" @click="pivot.print({ title: '2026 年各季度销售额' })">
        <template #leading><PrinterIcon /></template>
        打印
      </DouButton>
    </DouSpace>
    <DouPivot
      ref="pivot"
      v-model:config="config"
      v-model:collapsed="collapsed"
      :data="orders"
      :fields="fields"
      :max-height="300"
      aria-label="各季度销售额"
    />
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
</style>
