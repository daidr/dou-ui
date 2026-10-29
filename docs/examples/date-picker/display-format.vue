<script setup>
import { ref } from 'vue'

const day = ref('2026-10-29')
const month = ref('2026-10')
</script>

<template>
  <DouDatePicker v-model="day" display-format="DD/MM/YYYY" />
  <DouDatePicker v-model="month" type="month" display-format="YYYY[年]MM[月]" />
  <DouText variant="secondary">值：{{ day }}、{{ month }}</DouText>
</template>
