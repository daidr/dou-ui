<script setup>
import { DouSheet } from '@dou-ui/sheet'
import { DouButton } from 'dou-ui'
import { ref, shallowRef } from 'vue'

const book = ref({
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
const sheet = shallowRef()
const run = (name) => sheet.value?.commands.run(name)
const pressed = (name) => !!sheet.value?.commands.pressed(name)
</script>

<template>
  <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px">
    <DouButton size="sm" :variant="pressed('bold') ? 'solid' : 'outline'" @click="run('bold')">
      加粗
    </DouButton>
    <DouButton size="sm" variant="outline" @click="run('merge')">合并</DouButton>
    <DouButton size="sm" :variant="pressed('filter') ? 'solid' : 'outline'" @click="run('filter')">
      筛选
    </DouButton>
    <DouButton size="sm" variant="outline" @click="run('find')">查找</DouButton>
  </div>
  <DouSheet ref="sheet" v-model="book" style="height: 200px" />
</template>
