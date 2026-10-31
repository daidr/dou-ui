<script setup>
import { DouChart, DouChartLine } from '@dou-ui/chart'
import { DouButton } from 'dou-ui'
import { onBeforeUnmount, shallowRef } from 'vue'

const rows = shallowRef([])
const loading = shallowRef(false)
let timer

// 模拟请求：一秒后拿到最近 12 周的注册人数
function load() {
  loading.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    rows.value = Array.from({ length: 12 }, (_, i) => ({
      week: `第 ${i + 1} 周`,
      signups: Math.round(400 + i * 35 + Math.random() * 120),
    }))
    loading.value = false
  }, 1000)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <DouButton size="sm" :disabled="loading" @click="load">
    {{ rows.length ? '重新加载' : '加载数据' }}
  </DouButton>
  <DouChart :data="rows" x="week" :height="260" :loading="loading" style="margin-top: 12px">
    <DouChartLine y="signups" name="注册人数" />
  </DouChart>
</template>
