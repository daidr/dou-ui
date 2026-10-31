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

/** What the map shows: every node and the view, with some room around. */
const world = computed<Rect>(() => {
  const all = boundsOf([...rects.value.map((r) => r.rect), visible.value])!
  const pad = Math.max(all.width, all.height) * 0.05
  return {
    x: all.x - pad,
    y: all.y - pad,
    width: all.width + pad * 2,
    height: all.height + pad * 2,
  }
})

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

function toWorld(event: PointerEvent): Point {
  const box = svg.value!.getBoundingClientRect()
  const [x, y, w, h] = viewBox.value.split(' ').map(Number) as [number, number, number, number]
  return {
    x: x + ((event.clientX - box.left) / box.width) * w,
    y: y + ((event.clientY - box.top) / box.height) * h,
  }
}

/** Centres the view on a point of the map. */
function moveTo(event: PointerEvent) {
  const p = toWorld(event)
  const { zoom } = flow.viewport.value
  const { width, height } = flow.size.value
  flow.viewport.value = { x: width / 2 - p.x * zoom, y: height / 2 - p.y * zoom, zoom }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.stopPropagation()
  dragging.value = true
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
