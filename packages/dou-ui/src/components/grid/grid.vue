<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { resolveResponsive, responsiveVar } from './responsive'
import type { GridGap, GridProps, GridSlots } from './grid'

defineOptions({ name: 'DouGrid' })

const props = withDefaults(defineProps<GridProps>(), { cols: 1, gap: 'md', align: 'stretch' })
defineSlots<GridSlots>()

const ns = useNamespace('grid')

const scale = new Set(['sm', 'md', 'lg'])
const length = (value: GridGap) =>
  typeof value === 'number' ? `${value}px` : scale.has(value) ? `var(--dou-space-${value})` : value

const style = computed(() => {
  const result: Record<string, string | number> = {}
  for (const [key, cols] of Object.entries(resolveResponsive(props.cols)))
    result[responsiveVar('--dou-grid-cols', key as 'base')] = cols
  if (props.minItemWidth !== undefined) result['--dou-grid-min'] = length(props.minItemWidth)
  const [row, column] = Array.isArray(props.gap) ? props.gap : [props.gap, props.gap]
  result['--dou-grid-row-gap'] = length(row)
  result['--dou-grid-column-gap'] = length(column)
  return result as CSSProperties
})
</script>

<template>
  <div
    :class="[ns.b(), ns.is('auto-fill', minItemWidth !== undefined), ns.m(`align-${align}`)]"
    :style="style"
  >
    <slot />
  </div>
</template>
