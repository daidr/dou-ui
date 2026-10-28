<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { breakpoints, resolveResponsive, responsiveVar } from './responsive'
import type { GridItemProps, GridItemSlots, GridSpan } from './grid'

defineOptions({ name: 'DouGridItem' })

const props = defineProps<GridItemProps>()
defineSlots<GridItemSlots>()

const ns = useNamespace('grid')

// Each breakpoint gets a complete `grid-column`, carrying forward whatever
// the smaller breakpoints set, so `span` and `start` can change apart.
const style = computed(() => {
  const spans = resolveResponsive<GridSpan>(props.span)
  const starts = resolveResponsive(props.start)
  const result: Record<string, string | number> = {}
  let span: GridSpan | undefined
  let start: number | undefined
  for (const key of breakpoints) {
    if (!(key in spans) && !(key in starts)) continue
    span = spans[key] ?? span
    start = starts[key] ?? start
    result[responsiveVar('--dou-grid-column', key)] =
      span === 'full' ? '1 / -1' : `${start ?? 'auto'} / span ${span ?? 1}`
  }
  if (props.rowSpan) result.gridRow = `span ${props.rowSpan}`
  return result as CSSProperties
})
</script>

<template>
  <div :class="ns.e('item')" :style="style">
    <slot />
  </div>
</template>
