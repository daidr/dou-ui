<script setup lang="ts">
import {
  DouSheet,
  DouSheetToolbar,
  defineSheetExporter,
  defineSheetExtension,
  type SheetWorkbook,
} from '@dou-ui/sheet'
import { ref } from 'vue'

/** 把每张工作表写成一组对象：第一行是字段名，下面每行一条记录。 */
const json = defineSheetExporter({
  name: 'json',
  label: 'JSON (.json)',
  extension: 'json',
  mime: 'application/json',
  scopes: ['sheet', 'workbook'],
  export: (source) => {
    const sheets = source.sheets.map(({ index, data, bounds }) => {
      if (!bounds) return { name: data.name, rows: [] }
      const keys = []
      for (let col = bounds.left; col <= bounds.right; col++)
        keys.push(source.text(index, bounds.top, col))
      const rows = []
      for (let row = bounds.top + 1; row <= bounds.bottom; row++)
        rows.push(
          Object.fromEntries(
            keys.map((key, i) => [key, source.plain(index, row, bounds.left + i)]),
          ),
        )
      return { name: data.name, rows }
    })
    return JSON.stringify(source.scope === 'workbook' ? sheets : sheets[0]!.rows, null, 2)
  },
})

const extensions = [defineSheetExtension({ name: 'json', exporters: [json] })]

const book = ref<SheetWorkbook>({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '门店',
      cells: [
        [
          { value: '门店', style: 'head' },
          { value: '城市', style: 'head' },
          { value: '店长', style: 'head' },
        ],
        ['静安店', '上海', '戴兜'],
        ['徐汇店', '上海', '阿青'],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" :extensions="extensions" style="height: 200px">
    <template #header>
      <DouSheetToolbar :tools="['export']" />
    </template>
  </DouSheet>
</template>
