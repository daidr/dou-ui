<script setup lang="ts">
import { DouGantt, GanttCSVError, type GanttCSVResult, type GanttDocument } from '@dou-ui/gantt'
import { DouButton, DouSpace, downloadBlob, toast } from 'dou-ui'
import { ref, useTemplateRef } from 'vue'
import { day } from './dates'

const plan = ref<GanttDocument>({
  version: 1,
  tasks: [
    { id: 'p', title: '门店小程序上线' },
    { id: 'ui', parent: 'p', title: '设计稿', start: day(-3), end: day(1), progress: 1 },
    { id: 'fe', parent: 'p', title: '页面开发', start: day(2), end: day(8), progress: 0.3 },
    { id: 'qa', parent: 'p', title: '测试', start: day(9), end: day(11) },
    { id: 'go', parent: 'p', title: '提交审核', type: 'milestone', start: day(12) },
  ],
  links: [
    { id: 'l1', from: 'ui', to: 'fe' },
    { id: 'l2', from: 'fe', to: 'qa' },
    { id: 'l3', from: 'qa', to: 'go' },
  ],
})

const gantt = useTemplateRef('gantt')
const picker = useTemplateRef('picker')

// 带上 ID 和上级任务 ID，导入时才能按 ID 更新，层级和依赖都保留
function saveCSV() {
  const csv = gantt.value?.toCSV({ ids: true })
  if (csv) downloadBlob(new Blob([csv], { type: 'text/csv' }), '排期.csv')
}

/** .xlsx 文件先用电子表格的读取函数转成 CSV，只有选了 .xlsx 时才加载它们。 */
async function readText(file: File) {
  if (!/\.xlsx$/i.test(file.name)) return file.text()
  const [{ readXlsx }, { sheetToCSV }] = await Promise.all([
    import('@dou-ui/sheet-xlsx'),
    import('@dou-ui/sheet/core'),
  ])
  const { book } = await readXlsx(file, { formulas: false })
  // 写入保存的值，日期是 2026-03-02 这样的写法
  return sheetToCSV(book.sheets[0]!)
}

const HEADERS: Record<string, string> = {
  id: 'ID',
  parent: '上级任务 ID',
  title: '任务',
  start: '开始',
  end: '结束',
  duration: '工期',
  progress: '进度',
}

/** 导入后的提示：带一个撤销按钮，焦点不在甘特图上时也能撤销。 */
function report({ tasks: read, warnings }: GanttCSVResult) {
  const undo = { label: '撤销', onClick: () => gantt.value?.undo() }
  if (!warnings.length) return toast.success(`已导入 ${read.length} 个任务`, { action: undo })
  const where = warnings
    .slice(0, 3)
    .map(({ row, column, text }) => `第 ${row} 行“${HEADERS[column] ?? column}”列的 ${text}`)
    .join('、')
  const more = warnings.length > 3 ? ` 等 ${warnings.length} 处` : ' '
  toast.warning(`已导入 ${read.length} 个任务，${where}${more}无法识别，这些值没有写入`, {
    action: undo,
  })
}

async function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !gantt.value) return
  try {
    const result = gantt.value.importCSV(await readText(file))
    if (result) report(result)
  } catch (error) {
    if (error instanceof GanttCSVError) toast.danger(error.reason)
    // 读不了的 .xlsx 文件，错误里也有给人看的原因
    else toast.danger((error as { reason?: string }).reason ?? '无法读取这个文件')
  }
}
</script>

<template>
  <DouSpace>
    <DouButton size="sm" @click="saveCSV">导出 CSV</DouButton>
    <DouButton size="sm" @click="picker?.click()">导入 CSV 或 Excel</DouButton>
    <input ref="picker" type="file" accept=".csv,.xlsx" hidden @change="onPick" />
  </DouSpace>
  <DouGantt
    ref="gantt"
    v-model="plan"
    :columns="[
      { key: 'title' },
      { key: 'start', width: 96 },
      { key: 'end', width: 96 },
      { key: 'progress', width: 64 },
    ]"
    :table-width="380"
    style="height: 260px"
  />
</template>
