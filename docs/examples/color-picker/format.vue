<script setup>
import { ref } from 'vue'

const formats = ['hex', 'rgb', 'hsl', 'hsv', 'hwb', 'lab', 'lch', 'oklab', 'oklch']
const fmt = ref('oklch')
const color = ref('oklch(0.55 0.15 255)')
</script>

<template>
  <div class="stack">
    <DouSegmentedControl v-model="fmt" :options="formats" size="sm" />
    <div class="row">
      <DouColorPicker v-model="color" :format="fmt" show-alpha />
      <DouText variant="tertiary" size="sm">v-model：{{ color }}</DouText>
    </div>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
</style>
