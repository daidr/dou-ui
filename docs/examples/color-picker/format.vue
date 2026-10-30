<script setup>
import { useBreakpoints } from 'dou-ui'
import { ref } from 'vue'

// nine formats do not fit in a row on a phone
const screen = useBreakpoints()

const formats = ['hex', 'rgb', 'hsl', 'hsv', 'hwb', 'lab', 'lch', 'oklab', 'oklch']
const fmt = ref('oklch')
const color = ref('oklch(0.55 0.15 255)')
</script>

<template>
  <div class="stack">
    <DouSegmentedControl v-if="screen.sm" v-model="fmt" :options="formats" size="sm" />
    <DouSelect
      v-else
      v-model="fmt"
      :options="formats"
      size="sm"
      style="width: 120px"
      aria-label="格式"
    />
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
  max-width: 100%;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  max-width: 100%;
}

.row > .dou-color-picker {
  max-width: 100%;
}
</style>
