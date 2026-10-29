<script setup>
import { ref } from 'vue'

const time = ref('09:30')
const seconds = ref('14:05:30')
</script>

<template>
  <DouInputTime v-model="time" style="width: 110px" />
  <DouInputTime v-model="seconds" format="HH:mm:ss" clearable style="width: 150px" />
  <DouText variant="tertiary" size="sm">{{ time ?? 'null' }} · {{ seconds ?? 'null' }}</DouText>
</template>
