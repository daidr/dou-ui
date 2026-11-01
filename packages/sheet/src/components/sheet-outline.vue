<script setup lang="ts">
import { MinusIcon, PlusIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import type { SheetAxis } from '../core/axis'
import {
  groupButtonLine,
  OUTLINE_LANE as LANE,
  type SheetGroupAxis,
  type SheetGroupLines,
} from '../core/group'

/*
 * The outline beside the row (or column) headers: a lane per depth, a line
 * along each group with a button on the line before it, and the level
 * buttons by the headers. It follows the grid's scroll from outside it.
 */

const props = defineProps<{
  axis: 'row' | 'col'
  groups: SheetGroupAxis
  lines: SheetAxis
  /** Frozen lines, which don't scroll. */
  frozen: number
  /** The header before the first line: the column letters for rows. */
  head: number
  scroll: number
  /** The grid's size along the axis. */
  view: number
  /** Whether to show the level buttons by the headers. */
  levels: boolean
  /** Labels of the buttons. */
  label: (group: SheetGroupLines) => string
  levelLabel: (level: number) => string
}>()

const emit = defineEmits<{
  toggle: [group: SheetGroupLines]
  level: [level: number]
  wheel: [event: WheelEvent]
}>()

/** How big the buttons in the lanes are. */
const BUTTON = 14

const frozenSize = computed(() => props.lines.offset(props.frozen))

interface Mark {
  key: string
  group: SheetGroupLines
  /** Across the lanes: the lane's middle. */
  lane: number
  /** The line along the group, from `from` to `to`, with its end tick at `tick`. */
  from: number
  to: number
  tick: 'start' | 'end' | null
  /** The middle of the button's line; `null` without a button. */
  button: number | null
  /** Whether the button's line is frozen: its button is drawn with the frozen lines alone. */
  frozenButton: boolean
}

const marks = computed(() => {
  const { lines, groups } = props
  const out: Mark[] = []
  for (const g of groups.list) {
    const at = groupButtonLine(g, lines.count)
    // inside a folded group, or on a hidden line: nothing to show
    if (at >= 0 && lines.hidden(at)) continue
    const lane = (g.depth - 1) * LANE + LANE / 2
    const button = at >= 0 ? lines.offset(at) + lines.size(at) / 2 : null
    const start = lines.offset(g.start)
    const end = lines.offset(g.end + 1)
    // without a line along it, a mark is just its button
    const alone = button ?? start
    const mark: Mark = {
      key: `${g.start}:${g.end}`,
      group: g,
      lane,
      from: alone,
      to: alone,
      tick: null,
      button,
      frozenButton: at >= 0 && at < props.frozen,
    }
    if (!g.collapsed && end > start) {
      if (button == null) Object.assign(mark, { from: start + 2, to: end - 2 })
      else if (at < g.start)
        Object.assign(mark, { from: button + BUTTON / 2, to: end - 2, tick: 'end' })
      else Object.assign(mark, { from: start + 2, to: button - BUTTON / 2, tick: 'start' })
    }
    out.push(mark)
  }
  return out
})

/** The marks within `from`–`to` along the axis. */
function within(from: number, to: number) {
  return marks.value.filter((m) => {
    const lo = Math.min(m.from, m.button ?? m.from) - BUTTON
    const hi = Math.max(m.to, m.button ?? m.to) + BUTTON
    return hi >= from && lo <= to
  })
}

const frozenMarks = computed(() => (frozenSize.value ? within(0, frozenSize.value) : []))
/** How far past the edges marks are still drawn, so a quick scroll doesn't show gaps. */
const OVERSCAN = 64

const bodyMarks = computed(() => {
  // before the grid has a size, all of them
  if (props.view <= 0) return marks.value
  const from = frozenSize.value + props.scroll
  return within(from - OVERSCAN, from + props.view + OVERSCAN)
})

const width = computed(() => (props.groups.depth + (props.levels ? 1 : 0)) * LANE)

/** A box placed along the axis at `pos` and across it at `lane`. */
function place(pos: number, lane: number, along: number, across: number) {
  return props.axis === 'row'
    ? `top:${pos}px;left:${lane}px;height:${along}px;width:${across}px`
    : `left:${pos}px;top:${lane}px;width:${along}px;height:${across}px`
}

function lineStyle(m: Mark) {
  return place(m.from, m.lane, Math.max(0, m.to - m.from), 6)
}

function buttonStyle(m: Mark) {
  return place(m.button! - BUTTON / 2, m.lane - BUTTON / 2, BUTTON, BUTTON)
}

const levelList = computed(() =>
  props.levels ? Array.from({ length: props.groups.depth + 1 }, (_, i) => i + 1) : [],
)

const layerStyle = (from: number, size?: number) =>
  props.axis === 'row'
    ? `top:${from}px;${size == null ? 'bottom:0' : `height:${size}px`};width:${width.value}px`
    : `left:${from}px;${size == null ? 'right:0' : `width:${size}px`};height:${width.value}px`

const shift = computed(() => {
  const by = -(frozenSize.value + props.scroll)
  return props.axis === 'row' ? `transform:translateY(${by}px)` : `transform:translateX(${by}px)`
})

defineExpose({ size: width })
</script>

<template>
  <div
    class="dou-sheet__outline"
    :class="`is-${axis}`"
    :style="axis === 'row' ? `width:${width}px` : `height:${width}px`"
    @wheel="emit('wheel', $event)"
  >
    <div
      v-if="levelList.length && head"
      class="dou-sheet__outline-levels"
      :style="layerStyle(0, head)"
    >
      <button
        v-for="level in levelList"
        :key="level"
        type="button"
        class="dou-sheet__outline-button is-level"
        :style="
          place(head / 2 - BUTTON / 2, (level - 1) * LANE + (LANE - BUTTON) / 2, BUTTON, BUTTON)
        "
        :aria-label="levelLabel(level)"
        tabindex="-1"
        @click="emit('level', level)"
      >
        {{ level }}
      </button>
    </div>
    <div
      v-for="layer in [
        { key: 'frozen', list: frozenMarks, style: layerStyle(head, frozenSize), inner: '' },
        { key: 'body', list: bodyMarks, style: layerStyle(head + frozenSize), inner: shift },
      ]"
      :key="layer.key"
      class="dou-sheet__outline-layer"
      :style="layer.style"
    >
      <div v-if="layer.list.length" class="dou-sheet__outline-inner" :style="layer.inner">
        <template v-for="m in layer.list" :key="m.key">
          <span
            v-if="m.to > m.from"
            class="dou-sheet__outline-line"
            :class="m.tick && `is-tick-${m.tick}`"
            :style="lineStyle(m)"
            aria-hidden="true"
          />
          <button
            v-if="m.button != null && m.frozenButton === (layer.key === 'frozen')"
            type="button"
            class="dou-sheet__outline-button"
            :style="buttonStyle(m)"
            :aria-label="label(m.group)"
            :aria-expanded="!m.group.collapsed"
            tabindex="-1"
            @click="emit('toggle', m.group)"
          >
            <PlusIcon v-if="m.group.collapsed" />
            <MinusIcon v-else />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
