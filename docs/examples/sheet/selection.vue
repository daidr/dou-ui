<script setup>
import { DouSheet, formatRange } from '@dou-ui/sheet'
import { computed, ref } from 'vue'

const book = ref({
  sheets: [
    {
      name: '库存',
      cells: [
        ['物品', '上海仓', '杭州仓'],
        ['显示器', 42, 18],
        ['键盘', 120, 64],
        ['鼠标', 98, 75],
      ],
    },
  ],
})
const selection = ref({
  active: { row: 1, col: 1 },
  ranges: [{ start: { row: 1, col: 1 }, end: { row: 3, col: 2 } }],
})
const picked = computed(() => selection.value.ranges.map(formatRange).join('、'))
</script>

<template>
  <DouSheet v-model="book" v-model:selection="selection" style="height: 200px" />
  <p>选中：{{ picked }}</p>
</template>
