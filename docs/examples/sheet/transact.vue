<script setup>
import { DouSheet } from '@dou-ui/sheet'
import { DouButton } from 'dou-ui'
import { ref, shallowRef } from 'vue'

const book = ref({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '采购',
      cells: [
        [
          { value: '物品', style: 'head' },
          { value: '数量', style: 'head' },
          { value: '单价', style: 'head' },
          { value: '小计', style: 'head' },
        ],
        ['键盘', 12, { value: 199, format: '¥#,##0' }, { value: '=B2*C2', format: '¥#,##0' }],
        ['显示器', 6, { value: 1299, format: '¥#,##0' }, { value: '=B3*C3', format: '¥#,##0' }],
      ],
    },
  ],
})

const sheet = shallowRef()
const log = ref('')

// 在第 2 行前插入一行并填好，撤销时作为一步
function addRow() {
  const done = sheet.value.transact((tr) => {
    tr.insertRows('2')
    tr.setCells('A2', [
      ['鼠标', 20, { value: 89, format: '¥#,##0' }, { value: '=B2*C2', format: '¥#,##0' }],
    ])
  })
  log.value = done.changed ? `改动了 ${done.steps.length} 步` : '没有改动'
}
</script>

<template>
  <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px">
    <DouButton size="sm" @click="addRow">插入一行</DouButton>
    <DouButton size="sm" variant="ghost" @click="sheet.undo()">撤销</DouButton>
    <span style="color: var(--dou-color-text-secondary); font-size: 13px">{{ log }}</span>
  </div>
  <DouSheet ref="sheet" v-model="book" style="height: 200px" />
</template>
