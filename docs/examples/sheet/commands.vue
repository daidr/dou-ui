<script setup lang="ts">
import { DouSheet, type SheetWorkbook } from '@dou-ui/sheet'
import { DouButton, DouToggle } from 'dou-ui'
import { ref, useTemplateRef } from 'vue'

const book = ref<SheetWorkbook>({
  version: 1,
  styles: { head: { bold: true } },
  sheets: [
    {
      name: '排班',
      cells: [
        [
          { value: '日期', style: 'head' },
          { value: '早班', style: 'head' },
          { value: '晚班', style: 'head' },
        ],
        ['11月3日', '戴兜', '阿青'],
        ['11月4日', '小林', '戴兜'],
        ['11月5日', '阿青', '小林'],
      ],
    },
  ],
})

// 表格外的按钮通过 ref 上的 commands 执行命令
const sheet = useTemplateRef<InstanceType<typeof DouSheet>>('sheet')
const run = (name: string) => sheet.value?.commands.run(name)
const pressed = (name: string) => !!sheet.value?.commands.pressed(name)
const can = (name: string) => !!sheet.value?.commands.can(name)
</script>

<template>
  <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px">
    <DouToggle size="sm" variant="outline" :pressed="pressed('bold')" @update:pressed="run('bold')">
      加粗
    </DouToggle>
    <DouButton size="sm" variant="outline" :disabled="!can('merge')" @click="run('merge')">
      合并
    </DouButton>
    <DouToggle
      size="sm"
      variant="outline"
      :pressed="pressed('filter')"
      @update:pressed="run('filter')"
    >
      筛选
    </DouToggle>
    <DouButton size="sm" variant="outline" @click="run('find')">查找</DouButton>
  </div>
  <DouSheet ref="sheet" v-model="book" style="height: 200px" />
</template>
