<script setup>
import { ref } from 'vue'

const meeting = ref('2026-11-03 14:30')
const month = ref('2026-11')
const year = ref('2026')
</script>

<template>
  <DouInputDate v-model="meeting" type="datetime" style="width: 200px" />
  <DouInputDate v-model="month" type="month" style="width: 130px" />
  <DouInputDate v-model="year" type="year" style="width: 100px" />
</template>
