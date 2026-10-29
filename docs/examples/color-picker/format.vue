<script setup>
import { ref } from 'vue'

const formats = ['hex', 'rgb', 'hsl', 'hsv', 'hwb', 'lab', 'lch', 'oklab', 'oklch']
const fmt = ref('oklch')
</script>

<template>
  <DouSegmentedControl v-model="fmt" :options="formats" size="sm" />
</template>
