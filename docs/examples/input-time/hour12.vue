<script setup>
import { ref } from 'vue'

const time = ref('21:05')
</script>

<template>
  <DouInputTime v-model="time" display-format="A hh:mm" style="width: 140px" />
  <DouText variant="tertiary" size="sm">{{ time ?? 'null' }}</DouText>
</template>
