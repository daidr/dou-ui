<script setup>
import { ref } from 'vue'

const budget = ref(1280000)
const rate = ref(0.125)
const visits = ref(23816)
</script>

<template>
  <DouInputNumber
    v-model="budget"
    :step="1000"
    :min="0"
    :format="{ style: 'currency', currency: 'CNY' }"
    clearable
    style="width: 200px"
  />
  <DouInputNumber
    v-model="rate"
    :step="0.005"
    :min="0"
    :max="1"
    :precision="3"
    :format="{ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }"
  />
  <DouInputNumber v-model="visits" :min="0" :format="(value) => `${value.toLocaleString()} 次`" />
</template>
