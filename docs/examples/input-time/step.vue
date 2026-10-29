<script setup>
import { ref } from 'vue'

const time = ref('10:15')
</script>

<template>
  <DouInputTime v-model="time" :minute-step="15" picker style="width: 130px" />
  <DouText variant="tertiary" size="sm">{{ time ?? 'null' }}</DouText>
</template>
