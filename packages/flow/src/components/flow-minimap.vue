<script setup lang="ts">
import { computed, ref } from 'vue'
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

/** `boxes` and some room around them. */
function framing(boxes: Rect[]): Rect {
  const all = boundsOf(boxes)!
  const pad = Math.max(all.width, all.height) * 0.05
  return {
    x: all.x - pad,
    y: all.y - pad,
    width: all.width + pad * 2,
    height: all.height + pad * 2,
  }
}

/** What the map shows: every node and the view. */
const fitted = computed(() => framing([...rects.value.map((r) => r.rect), visible.value]))

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
  // Room for wherever the view can go: until the nodes just leave it on any side.
  const { width, height } = visible.value
  held.value = framing([
    visible.value,
    ...rects.value.map(({ rect }) => ({
      x: rect.x - width,
      y: rect.y - height,
      width: rect.width + width * 2,
      height: rect.height + height * 2,
    })),
  ])
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
</script>

<template>
  <div
    class="dou-flow-minimap"
    data-flow-overlay
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
