<script setup>
import { ref } from 'vue'

const hours = ref(['09:00', '18:00'])
</script>

<template>
  <DouInputTime v-model="hours" range picker style="width: 220px" />
  <DouText variant="tertiary" size="sm">{{ hours ?? 'null' }}</DouText>
</template>
