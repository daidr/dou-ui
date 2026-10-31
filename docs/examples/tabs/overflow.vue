<script setup>
import { ref } from 'vue'

const months = Array.from({ length: 12 }, (_, index) => `${index + 1} 月报表`)
const tab = ref(months[9])
</script>

<template>
  <DouTabs v-model="tab">
    <DouTabPanel v-for="month in months" :key="month" :value="month" :label="month">
      {{ month }}的内容。
    </DouTabPanel>
  </DouTabs>
</template>
