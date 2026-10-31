<script setup>
import { DouSheet } from '@dou-ui/sheet'
import { shallowRef } from 'vue'

// 10 000 rows × 20 columns: 200 000 cells
const rows = 10000
const cols = 20
const cells = Array.from({ length: rows }, (_, r) =>
  Array.from({ length: cols }, (__, c) => (c === 0 ? `第 ${r + 1} 行` : (r * 7 + c * 13) % 1000)),
)

// a shallow ref: the sheet replaces rows instead of changing them, so deep tracking isn't needed
const book = shallowRef({ sheets: [{ name: '大表', freeze: { cols: 1 }, cells }] })
</script>

<template>
  <DouSheet v-model="book" style="height: 400px" />
</template>
