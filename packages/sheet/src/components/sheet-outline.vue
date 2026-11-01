<script setup lang="ts">
import { MinusIcon, PlusIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import type { SheetAxis } from '../core/axis'
import {
  OUTLINE_LANE as LANE,
  type SheetGroupAxis,
  type SheetGroupLines,
  type SheetGroupSummary,
} from '../core/group'

/*
 * The outline beside the row (or column) headers: a lane per depth, a line
 * along each group with a button on its summary line, and the level
 * buttons by the headers. It follows the grid's scroll from outside it.
 */

const props = defineProps<{
  axis: 'row' | 'col'
  groups: SheetGroupAxis
  /** Which side of a group its button is on. */
  summary: SheetGroupSummary
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
  /** The room before the outline along the axis, the other outline's corner, which a finger may reach into. */
  before: number
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
    const at = groups.buttonLine(g, lines.count, props.summary)
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

/** How far a finger's touch reaches from a button's middle, at most: 40px across. */
const REACH = 20

/**
 * The touch target around a button, as an inset: as far as `REACH` each
 * way, and only halfway to a button nearby, so neighbours don't overlap.
 */
function reach(before: number, after: number, start: number, end: number) {
  const half = BUTTON / 2
  // the inset counts from inside the button's 1px border
  const [a1, a2, c1, c2] = [before, after, start, end].map((n) => -(Math.max(half, n) - half + 1))
  return props.axis === 'row'
    ? `--dou-sheet-hit:${a1}px ${c2}px ${a2}px ${c1}px`
    : `--dou-sheet-hit:${c1}px ${a2}px ${c2}px ${a1}px`
}

const hits = computed(() => {
  const out = new Map<string, string>()
  const buttons = marks.value.filter((m) => m.button != null)
  for (const m of buttons) {
    let before = REACH
    let after = REACH
    let start = REACH
    let end = REACH
    for (const o of buttons) {
      if (o === m) continue
      const along = o.button! - m.button!
      const across = o.lane - m.lane
      if (across === 0) {
        if (along > 0) after = Math.min(after, along / 2)
        else before = Math.min(before, -along / 2)
      } else if (Math.abs(along) < REACH * 2) {
        if (across > 0) end = Math.min(end, across / 2)
        else start = Math.min(start, -across / 2)
      }
    }
    out.set(m.key, reach(before, after, start, end))
  }
  return out
})

function buttonStyle(m: Mark) {
  return `${place(m.button! - BUTTON / 2, m.lane - BUTTON / 2, BUTTON, BUTTON)};${hits.value.get(m.key)}`
}

/** Where a mark's button shows along the outline, or `null` when it is scrolled away. */
function shownAt(m: Mark) {
  if (m.button == null) return null
  if (m.frozenButton) return props.head + m.button
  const at = props.head + m.button - props.scroll
  return at >= props.head + frozenSize.value ? at : null
}

/**
 * A level button: side by side with the others across the lanes. Along the
 * axis it reaches into the corner before it and, for what it can't get
 * there, further toward the lines, short of the group buttons in its lane.
 * The outline doesn't clip, so the reach can leave the levels' band.
 */
function levelStyle(level: number) {
  const middle = props.head / 2
  const box = place(middle - BUTTON / 2, (level - 1) * LANE + (LANE - BUTTON) / 2, BUTTON, BUTTON)
  const lane = (level - 1) * LANE + LANE / 2
  let room = Infinity
  for (const m of marks.value) {
    const at = m.lane === lane ? shownAt(m) : null
    if (at != null) room = Math.min(room, (at - middle) / 2)
  }
  const before = Math.min(REACH, middle + props.before)
  const after = Math.min(REACH * 2 - before, room)
  // across, the lane alone: past it are the sheet's edge, the other levels and the headers
  return `${box};${reach(before, after, LANE / 2, LANE / 2)}`
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
        :style="levelStyle(level)"
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
