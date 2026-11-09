<script setup lang="ts">
import { computed } from 'vue'
import {
  labelOf,
  type BlockOptionChoicesEmits,
  type BlockOptionChoicesProps,
} from '../../core/extension'

/**
 * The column count picker beside “Columns” in the slash menu: a row of
 * bars, as many as the most columns; pointing at one lights the bars up to
 * it, the count a click inserts.
 */
const props = defineProps<BlockOptionChoicesProps>()
const emit = defineEmits<BlockOptionChoicesEmits>()

const counts = computed(() => props.items.map((item) => Number(item.props.count)))
const bars = computed(() => Math.max(...counts.value))
/** Bars lit up to here; none while the option itself is highlighted. */
const lit = computed(() => (props.active < 0 ? 0 : (counts.value[props.active] ?? 0)))

/** The choice a bar stands for: its count, or the fewest there can be. */
const indexOf = (bar: number) => {
  const index = counts.value.indexOf(Math.max(bar, counts.value[0]!))
  return index < 0 ? 0 : index
}
</script>

<template>
  <div class="dou-editor-column-picker">
    <div
      v-for="bar in bars"
      :id="bar >= counts[0]! ? `${idPrefix}-${indexOf(bar)}` : undefined"
      :key="bar"
      :role="bar >= counts[0]! ? 'option' : 'presentation'"
      :aria-selected="bar >= counts[0]! ? bar === lit : undefined"
      :aria-label="bar >= counts[0]! ? labelOf(items[indexOf(bar)]!.label, messages) : undefined"
      :class="['dou-editor-column-picker__bar', { 'is-lit': bar <= lit }]"
      @pointermove="emit('hover', indexOf(bar))"
      @click="emit('choose', indexOf(bar))"
    />
  </div>
</template>
