<script setup>
import { DownloadIcon, UploadIcon } from '@dou-ui/icons'
import { DouSheet, DouSheetTabs, readCSV } from '@dou-ui/sheet'
import { ref, useTemplateRef } from 'vue'

const book = ref({
  sheets: [
    {
      name: '门店',
      colSizes: { 0: 120, 1: 140 },
      cells: [
        ['门店', '开业日期', '面积'],
        ['上海静安', { value: '2021-04-18', format: 'yyyy年m月d日' }, 128],
        ['上海徐汇', { value: '2023-09-02', format: 'yyyy年m月d日' }, 96],
      ],
    },
  ],
})
const active = ref(0)
const grid = useTemplateRef('grid')
const file = useTemplateRef('file')

async function importFile(event) {
  const picked = event.target.files?.[0]
  event.target.value = ''
  if (!picked) return
  const cells = readCSV(await picked.text())
  let name = picked.name.replace(/\.(csv|tsv|txt)$/i, '')
  grid.value.transact((tr) => {
    name = tr.uniqueName(name)
    tr.addSheet({ name, cells })
  })
  grid.value.showSheet(name)
}

function exportFile() {
  const text = grid.value.toCSV({ bom: true })
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${book.value.sheets[active.value].name}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div style="display: flex; gap: 8px; margin-bottom: 12px">
    <DouButton variant="outline" @click="file.click()">
      <template #leading><UploadIcon /></template>
      导入 CSV
    </DouButton>
    <DouButton variant="outline" @click="exportFile">
      <template #leading><DownloadIcon /></template>
      导出 CSV
    </DouButton>
    <input ref="file" type="file" accept=".csv,.tsv,.txt,text/csv" hidden @change="importFile" />
  </div>
  <DouSheet ref="grid" v-model="book" v-model:active-sheet="active" style="height: 240px">
    <template #footer>
      <DouSheetTabs />
    </template>
  </DouSheet>
</template>
