<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useFlowEditor, type FlowMinimapProps } from '../context'
import { boundsOf } from '../core/geometry'
import type { Point, Rect } from '../core/model'

defineOptions({ name: 'DouFlowMinimap' })

const props = withDefaults(defineProps<FlowMinimapProps>(), {
  placement: 'bottom-right',
  width: 200,
  height: 136,
})

const flow = useFlowEditor()
const { messages } = flow

/** The part of the canvas on screen, in canvas coordinates. */
const visible = computed<Rect>(() => {
  const { x, y, zoom } = flow.viewport.value
  const { width, height } = flow.size.value
  return { x: -x / zoom, y: -y / zoom, width: width / zoom, height: height / zoom }
})

const rects = computed(() =>
  flow.doc.value.nodes.flatMap((node) => {
    const rect = flow.getNodeRect(node.id)
    return rect ? [{ id: node.id, rect, selected: flow.selectedNodes.value.has(node.id) }] : []
  }),
)

/** What the map shows: every node and the view, with some room around. */
const fitted = computed<Rect>(() => {
  const all = boundsOf([...rects.value.map((r) => r.rect), visible.value])!
  const pad = Math.max(all.width, all.height) * 0.05
  return {
    x: all.x - pad,
    y: all.y - pad,
    width: all.width + pad * 2,
    height: all.height + pad * 2,
  }
})

/**
 * Held still while the view is dragged: a map that grew to take in the view
 * as it went would slide away under the pointer, sending the view further
 * each time.
 */
const held = ref<Rect | null>(null)
const world = computed(() => held.value ?? fitted.value)

/** Canvas units per map pixel; the map keeps the canvas's proportions. */
const scale = computed(() =>
  Math.max(world.value.width / props.width, world.value.height / props.height, 1e-6),
)
const viewBox = computed(() => {
  const w = props.width * scale.value
  const h = props.height * scale.value
  const { x, y, width, height } = world.value
  return `${x - (w - width) / 2} ${y - (h - height) / 2} ${w} ${h}`
})

/** Everything outside the view, shaded: the map's box with the view cut out. */
const shade = computed(() => {
  const [x, y, w, h] = viewBox.value.split(' ').map(Number) as [number, number, number, number]
  const v = visible.value
  return `M${x} ${y}h${w}v${h}h${-w}Z M${v.x} ${v.y}v${v.height}h${v.width}v${-v.height}Z`
})

const svg = ref<SVGSVGElement>()
const dragging = ref(false)

/** How far along a side `at` is, from 0 to 1, staying on it when past its ends. */
const along = (at: number, start: number, length: number) =>
  length ? Math.min(1, Math.max(0, (at - start) / length)) : 0.5

/** The point of the map under the pointer; past its edges, the nearest point on them. */
function toWorld(event: PointerEvent): Point {
  const box = svg.value!.getBoundingClientRect()
  const [x, y, w, h] = viewBox.value.split(' ').map(Number) as [number, number, number, number]
  return {
    x: x + along(event.clientX, box.left, box.width) * w,
    y: y + along(event.clientY, box.top, box.height) * h,
  }
}

/** Centres the view on a point of the map, as far as the nodes allow. */
function moveTo(event: PointerEvent) {
  const p = toWorld(event)
  const { zoom } = flow.viewport.value
  const { width, height } = flow.size.value
  flow.setViewport({ x: width / 2 - p.x * zoom, y: height / 2 - p.y * zoom, zoom })
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.stopPropagation()
  dragging.value = true
  // The map as it is now: the press lands where it was seen.
  held.value = fitted.value
  try {
    svg.value!.setPointerCapture(event.pointerId)
  } catch {
    // Synthetic events have no pointer to capture.
  }
  moveTo(event)
}

function onPointerMove(event: PointerEvent) {
  if (dragging.value) moveTo(event)
}

function onPointerUp() {
  dragging.value = false
  held.value = null
}

const el = ref<HTMLElement>()
/** How far the map moves away from its edge to clear the other panels there, in px. */
const lift = ref(0)
const LIFT_GAP = 8

/**
 * On a narrow editor the map would cover a panel in the same corner row,
 * e.g. the controls: then it sits above (or below) them instead.
 */
function place() {
  const self = el.value
  const root = flow.root.value
  if (!self || !root) return
  const upper = props.placement.startsWith('top')
  const box = self.getBoundingClientRect()
  // where the map is without the lift
  const top = box.top + (upper ? -lift.value : lift.value)
  const bottom = top + box.height
  let next = 0
  for (const panel of root.querySelectorAll('.dou-flow-editor__panels > *')) {
    if (panel === self || panel.classList.contains('dou-flow-minimap')) continue
    const rect = panel.getBoundingClientRect()
    if (!rect.width || !rect.height) continue
    if (rect.right <= box.left || rect.left >= box.right) continue
    if (rect.bottom <= top || rect.top >= bottom) continue
    next = Math.max(next, upper ? rect.bottom - top + LIFT_GAP : bottom - rect.top + LIFT_GAP)
  }
  lift.value = next
}

// Panels come, go and change size after the map is shown (controls put in
// later, undo hidden when made read-only…): place it again each time.
let resizes: ResizeObserver | undefined
let changes: MutationObserver | undefined
function watchPanels() {
  const panels = el.value?.parentElement
  if (!panels) return
  resizes?.disconnect()
  if (typeof ResizeObserver !== 'undefined') {
    resizes = new ResizeObserver(() => place())
    for (const panel of panels.children) if (panel !== el.value) resizes.observe(panel)
  }
  place()
}

onMounted(() => {
  nextTick(watchPanels)
  const panels = el.value?.parentElement
  if (panels && typeof MutationObserver !== 'undefined') {
    changes = new MutationObserver(watchPanels)
    changes.observe(panels, { childList: true })
  }
})
onBeforeUnmount(() => {
  resizes?.disconnect()
  changes?.disconnect()
})
watch(
  () => [flow.size.value.width, flow.size.value.height, props.width, props.height, props.placement],
  () => nextTick(place),
)
</script>

<template>
  <div
    ref="el"
    class="dou-flow-minimap"
    data-flow-overlay
    :style="lift ? { translate: `0 ${placement.startsWith('top') ? lift : -lift}px` } : undefined"
    :class="[`is-${placement}`, { 'is-dragging': dragging }]"
    role="img"
    :aria-label="messages.minimap"
  >
    <svg
      ref="svg"
      :width="width"
      :height="height"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <rect
        v-for="item in rects"
        :key="item.id"
        class="dou-flow-minimap__node"
        :class="{ 'is-selected': item.selected }"
        :x="item.rect.x"
        :y="item.rect.y"
        :width="item.rect.width"
        :height="item.rect.height"
        :rx="2 * scale"
      />
      <path class="dou-flow-minimap__shade" :d="shade" fill-rule="evenodd" />
      <rect
        class="dou-flow-minimap__view"
        :x="visible.x"
        :y="visible.y"
        :width="visible.width"
        :height="visible.height"
      />
    </svg>
  </div>
</template>
