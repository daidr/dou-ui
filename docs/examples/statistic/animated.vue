<script setup>
import { ref } from 'vue'

const visits = ref(12846)
const rate = ref(3.42)

function refresh() {
  visits.value += Math.round(Math.random() * 2000 + 200)
  rate.value = Math.round((Math.random() * 4 + 1) * 100) / 100
}
</script>

<template>
  <DouStatistic title="今日访问" :value="visits" animated />
  <DouStatistic title="转化率" :value="rate" :precision="2" suffix="%" animated />
  <DouButton variant="outline" size="sm" @click="refresh">刷新数据</DouButton>
</template>
