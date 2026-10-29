<script setup>
import { ref } from 'vue'

const time = ref('09:30')
const seconds = ref('14:05:30')
</script>

<template>
  <DouTimePicker v-model="time" style="width: 140px" />
  <DouTimePicker v-model="seconds" format="HH:mm:ss" style="width: 160px" />
  <DouText variant="tertiary" size="sm">{{ time }} · {{ seconds }}</DouText>
</template>
