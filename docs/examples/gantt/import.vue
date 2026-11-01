<script setup lang="ts">
import { DouGantt, type GanttCSVResult, type GanttLink, type GanttTask } from '@dou-ui/gantt'
import { DouButton, DouSpace, downloadBlob, toast } from 'dou-ui'
import { ref, useTemplateRef } from 'vue'
import { day } from './dates'

const tasks = ref<GanttTask[]>([
  { id: 'p', title: '门店小程序上线' },
  { id: 'ui', parent: 'p', title: '设计稿', start: day(-3), end: day(1), progress: 1 },
  { id: 'fe', parent: 'p', title: '页面开发', start: day(2), end: day(8), progress: 0.3 },
  { id: 'qa', parent: 'p', title: '测试', start: day(9), end: day(11) },
  { id: 'go', parent: 'p', title: '提交审核', type: 'milestone', start: day(12) },
])
const links = ref<GanttLink[]>([
  { id: 'l1', from: 'ui', to: 'fe' },
  { id: 'l2', from: 'fe', to: 'qa' },
  { id: 'l3', from: 'qa', to: 'go' },
])

const gantt = useTemplateRef('gantt')
const picker = useTemplateRef('picker')

// 带上 ID 和上级任务 ID，导入时才能按 ID 更新，层级和依赖都保留
function saveCSV() {
  const csv = gantt.value?.exportCSV({ ids: true })
  if (csv) downloadBlob(new Blob([csv], { type: 'text/csv' }), '排期.csv')
}

/** .xlsx 文件先用电子表格的读取函数转成 CSV，只有选了 .xlsx 时才加载它们。 */
async function readText(file: File) {
  if (!/\.xlsx$/i.test(file.name)) return file.text()
  const [{ readXlsx }, { sheetToCSV }] = await Promise.all([
    import('@dou-ui/sheet-xlsx'),
    import('@dou-ui/sheet/core'),
  ])
  const { book } = await readXlsx(file)
  // 写入保存的值，日期是 2026-03-02 这样的写法
  return sheetToCSV(book.sheets[0]!, { formatted: false })
}

function report(result: GanttCSVResult) {
  const { tasks: read, problems } = result
  if (!problems.length)
    return toast.success(`已导入 ${read.length} 个任务，按 ⌘Z / Ctrl+Z 可以撤销`)
  const where = problems.map((problem) => `第 ${problem.row} 行的 ${problem.text}`).join('、')
  toast.warning(`已导入 ${read.length} 个任务，${where}无法识别，已跳过`)
}

async function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !gantt.value) return
  try {
    report(gantt.value.importCSV(await readText(file)))
  } catch (error) {
    // 读不了的 .xlsx 文件会给出原因，其他情况是文件里没有“任务”列
    const reason = (error as { reason?: string }).reason
    toast.danger(reason ?? '没有找到“任务”列，请选择从甘特图导出的文件')
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
    v-model:tasks="tasks"
    v-model:links="links"
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
