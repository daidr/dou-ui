<script setup>
import { DouSheet, DouSheetTabs, DouSheetToolbar } from '@dou-ui/sheet'
import { xlsx } from '@dou-ui/sheet-xlsx'
import { toast } from 'dou-ui'
import { ref } from 'vue'

const extensions = [xlsx()]

// 文件里有、表格放不下的内容，读完时告诉用户
function onImport(event) {
  if (event.warnings.length)
    toast.warning(`没有导入：${[...new Set(event.warnings.map((w) => w.message))].join('、')}`)
}

const book = ref({
  styles: {
    head: { bold: true, fill: 'neutral' },
    money: { align: 'right' },
  },
  types: {
    status: { type: 'select', options: ['筹备中', { value: '营业中', tone: 'success' }] },
  },
  sheets: [
    {
      name: '门店',
      colSizes: { 0: 120, 1: 120, 2: 100, 3: 110 },
      freeze: { rows: 1 },
      cells: [
        [
          { value: '门店', style: 'head' },
          { value: '开业日期', style: 'head' },
          { value: '状态', style: 'head' },
          { value: '本月营收', style: 'head' },
        ],
        [
          '上海静安',
          '2021-04-18',
          { value: '营业中', type: 'status' },
          { value: 186400, format: '¥#,##0', note: '含会员储值' },
        ],
        [
          '上海徐汇',
          '2023-09-02',
          { value: '营业中', type: 'status' },
          { value: 129800, format: '¥#,##0' },
        ],
        [
          '上海长宁',
          '2026-12-01',
          { value: '筹备中', type: 'status' },
          { value: 0, format: '¥#,##0' },
        ],
        [
          { value: '合计', style: 'head' },
          null,
          null,
          { value: '=SUM(D2:D4)', format: '¥#,##0', style: 'head' },
        ],
      ],
      conditionalFormats: [{ range: 'D2:D4', bar: 'primary' }],
    },
  ],
})
</script>

<template>
  <!-- 导出菜单里多了 XLSX，导入按钮和拖入文件也能读 .xlsx；公式、格式、样式、批注和下拉选项都会带进文件 -->
  <DouSheet
    v-model="book"
    :extensions="extensions"
    file-drop
    style="height: 260px"
    @import="onImport"
  >
    <template #header>
      <DouSheetToolbar
        :tools="['undo', 'redo', '|', 'bold', 'italic', '|', 'import', 'export']"
        file-name="门店营收"
      />
    </template>
    <template #footer>
      <DouSheetTabs />
    </template>
  </DouSheet>
</template>
