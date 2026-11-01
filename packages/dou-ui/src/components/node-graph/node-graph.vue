<script setup lang="ts">
import { FlagIcon, FocusIcon, InfoIcon, ZoomInIcon, ZoomOutIcon } from '@dou-ui/icons'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { useLocale } from '../config-provider/use-config'
import { useFormSize } from '../form/use-form-item'
import { DouPopover } from '../popover'
import DouNodeGraphLegend from './node-graph-legend.vue'
import { acyclic, layoutGraph, rank } from './layout'
import type {
  NodeGraphExpose,
  NodeGraphProps,
  NodeGraphSlots,
  GraphEdge,
  GraphNode,
  GraphNodeSlotProps,
  GraphNodeStatus,
} from './node-graph'

defineOptions({ name: 'DouNodeGraph' })

const props = withDefaults(defineProps<NodeGraphProps>(), {
  selectable: true,
  direction: 'horizontal',
  nodeWidth: 'column',
  maxNodeWidth: 320,
  highlight: 'hover',
  autoBlocked: false,
  pannable: true,
  zoomable: false,
  minZoom: 0.25,
  maxZoom: 2,
  legend: false,
})
const selected = defineModel<string | string[] | null>('selected', { default: null })
const zoom = defineModel<number>('zoom', { default: 1 })
const hovered = defineModel<string | null>('hovered', { default: null })
const emit = defineEmits<{
  nodeClick: [node: GraphNode, event: MouseEvent]
  nodeDblclick: [node: GraphNode, event: MouseEvent]
  nodeEnter: [node: GraphNode, el: HTMLElement]
  nodeLeave: [node: GraphNode, el: HTMLElement]
}>()
const slots = defineSlots<NodeGraphSlots>()

const ns = useNamespace('node-graph')
const { t } = useLocale()
const size = useFormSize(() => props.size)

/** Room around the graph for focus rings and corner badges. */
const PAD = 16
const metrics = {
  sm: { columnGap: 44, rowGap: 16, height: 28, font: 13 },
  md: { columnGap: 56, rowGap: 20, height: 32, font: 14 },
  lg: { columnGap: 64, rowGap: 24, height: 40, font: 16 },
}
const metric = computed(() => metrics[size.value])

// Graph structure ------------------------------------------------------------

const byId = computed(() => new Map(props.nodes.map((node) => [node.id, node])))
const dag = computed(() =>
  acyclic(
    props.nodes.map((n) => n.id),
    props.edges,
  ),
)
const preds = computed(() => {
  const map = new Map<string, string[]>(props.nodes.map((n) => [n.id, []]))
  for (const { from, to } of dag.value.edges) map.get(to)!.push(from)
  return map
})
const succs = computed(() => {
  const map = new Map<string, string[]>(props.nodes.map((n) => [n.id, []]))
  for (const { from, to } of dag.value.edges) map.get(from)!.push(to)
  return map
})

function statusOf(node: GraphNode): GraphNodeStatus {
  const status = node.status ?? 'wait'
  if (props.autoBlocked && status === 'process') {
    const waiting = preds.value
      .get(node.id)
      ?.some((id) => (byId.value.get(id)?.status ?? 'wait') !== 'finish')
    if (waiting) return 'blocked'
  }
  return status
}

// The legend lists the statuses as shown, after `autoBlocked`.
const shownNodes = computed(() => props.nodes.map((node) => ({ ...node, status: statusOf(node) })))

// A second line or a progress bar does not fit a capsule.
const isCard = (node: GraphNode) =>
  node.shape === 'card' ||
  (node.shape !== 'pill' && (node.description != null || node.progress != null))

// Measuring and layout -------------------------------------------------------

const nodeEls = new Map<string, HTMLElement>()
const sizes = shallowRef(new Map<string, { width: number; height: number }>())

function estimate(node: GraphNode) {
  const { height, font } = metric.value
  const text = node.label.length + String(node.extra ?? '').length * 0.6
  const width =
    typeof props.nodeWidth === 'number'
      ? props.nodeWidth
      : Math.min(props.maxNodeWidth, Math.round(text * font + 48))
  return { width, height: isCard(node) ? height * 2 : height }
}

const roundUp = (value: number, step: number) => Math.ceil(value / step - 0.001) * step

/**
 * The layout size of an element: width rounded up to even pixels, height
 * to a multiple of four, so centres on the row grid keep edges on whole,
 * even pixels.
 */
function box(el: HTMLElement) {
  // Fractional sizes, so a label a hair wider than a whole pixel is not cut
  // off; the zoom is undone, as the canvas is scaled.
  const rect = el.getBoundingClientRect()
  return {
    width: roundUp(rect.width / zoom.value, 2),
    height: roundUp(rect.height / zoom.value, 4),
  }
}

function measure() {
  if (typeof window === 'undefined') return
  const column = rank(dag.value.order, dag.value.edges)
  // Every write, then every read: one layout for all nodes, not one each.
  const els: [string, HTMLElement, string, string][] = []
  for (const node of props.nodes) {
    const el = nodeEls.get(node.id)
    if (el) els.push([node.id, el, el.style.width, el.style.height])
  }
  const free = typeof props.nodeWidth === 'number' ? `${props.nodeWidth}px` : 'max-content'
  for (const [, el] of els) Object.assign(el.style, { width: free, height: '' })
  const natural = new Map<string, number>()
  for (const [id, el] of els) natural.set(id, Math.min(box(el).width, props.maxNodeWidth))
  const columnWidth = new Map<number, number>()
  for (const [id, width] of natural) {
    const c = column.get(id) ?? 0
    columnWidth.set(c, Math.max(columnWidth.get(c) ?? 0, width))
  }
  const widths = new Map<string, number>()
  for (const [id, el] of els) {
    const own = natural.get(id)
    // Not laid out, e.g. hidden or without a DOM: keep the estimate.
    if (!own) continue
    const width = props.nodeWidth === 'column' ? columnWidth.get(column.get(id) ?? 0)! : own
    widths.set(id, width)
    el.style.width = `${width}px`
  }
  const next = new Map<string, { width: number; height: number }>()
  for (const [id, el] of els) {
    const width = widths.get(id)
    if (width) next.set(id, { width, height: box(el).height })
  }
  for (const [, el, width, height] of els) Object.assign(el.style, { width, height })
  const prev = sizes.value
  const same =
    prev.size === next.size &&
    [...next].every(
      ([id, s]) => prev.get(id)?.width === s.width && prev.get(id)?.height === s.height,
    )
  if (!same) sizes.value = next
}

const vertical = computed(() => props.direction === 'vertical')

const layout = computed(() => {
  const nodes = props.nodes.map((node) => ({
    id: node.id,
    ...(sizes.value.get(node.id) ?? estimate(node)),
  }))
  // The gaps keep their sides on screen: between ranks is a column gap
  // left to right and a row gap top to bottom.
  const rankGap = vertical.value ? props.rowGap : props.columnGap
  const laneGap = (vertical.value ? props.columnGap : props.rowGap) ?? metric.value.rowGap
  if (vertical.value)
    // Every node is centred on a lane as wide as the widest node, half a
    // lane apart: fans stay symmetric and no edge wobbles by a few px.
    return layoutGraph(nodes, dag.value.edges, {
      direction: 'vertical',
      columnGap: rankGap ?? metric.value.columnGap,
      rowGap: laneGap,
      grid: (Math.max(0, ...nodes.map((n) => n.width)) + laneGap) / 2,
      // Along the flow nodes keep their height; the edge leaves a capsule
      // in a row of cards from its own bottom.
      equalWidth: false,
    })
  return layoutGraph(
    // Edges meet a card at its title line, level with a capsule's middle.
    nodes.map((node) => ({ ...node, anchor: metric.value.height / 2 })),
    dag.value.edges,
    {
      columnGap: rankGap ?? metric.value.columnGap,
      rowGap: laneGap,
      // Half the pitch of one-line nodes.
      grid: (metric.value.height + laneGap) / 2,
      equalWidth: props.nodeWidth === 'column',
    },
  )
})

const contentWidth = computed(() => layout.value.width + PAD * 2)
const contentHeight = computed(() => layout.value.height + PAD * 2)

let frame = 0
function scheduleMeasure() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(measure)
}
let nodeObserver: ResizeObserver | undefined
function setNodeRef(id: string, el: unknown) {
  const old = nodeEls.get(id)
  if (el instanceof HTMLElement) {
    if (old === el) return
    if (old) nodeObserver?.unobserve(old)
    nodeEls.set(id, el)
    nodeObserver?.observe(el)
  } else if (old) {
    nodeObserver?.unobserve(old)
    nodeEls.delete(id)
  }
}

watch(
  () => [
    props.nodes,
    props.edges,
    size.value,
    props.nodeWidth,
    props.maxNodeWidth,
    props.direction,
  ],
  () => nextTick(measure),
  { deep: true },
)

// Viewport, panning and zooming ---------------------------------------------

const rootRef = ref<HTMLElement | null>(null)
const viewport = ref({ width: 0, height: 0 })
const x = ref(0)
const y = ref(0)
/** True while dragging, scrolling or zooming; hover popovers stay shut. */
const moving = ref(false)

const scaledWidth = computed(() => contentWidth.value * zoom.value)
const scaledHeight = computed(() => contentHeight.value * zoom.value)
const canPanX = computed(() => props.pannable && scaledWidth.value > viewport.value.width + 0.5)
const canPanY = computed(() => props.pannable && scaledHeight.value > viewport.value.height + 0.5)

function clampAxis(value: number, content: number, view: number) {
  if (content <= view) return Math.min(Math.max(value, 0), view - content)
  return Math.min(Math.max(value, view - content), 0)
}
function moveTo(nextX: number, nextY: number) {
  // Before the box is measured there is nothing to keep in view.
  if (!viewport.value.width) return
  x.value = Math.round(clampAxis(nextX, scaledWidth.value, viewport.value.width))
  y.value = Math.round(clampAxis(nextY, scaledHeight.value, viewport.value.height))
}

function clampZoom(value: number) {
  return Math.min(props.maxZoom, Math.max(props.minZoom, value))
}
/** Zoom keeping the point at (`px`, `py`) in the box still. */
function zoomAt(value: number, px = viewport.value.width / 2, py = viewport.value.height / 2) {
  const next = clampZoom(value)
  const ratio = next / zoom.value
  const nextX = px - (px - x.value) * ratio
  const nextY = py - (py - y.value) * ratio
  zoom.value = next
  moveTo(nextX, nextY)
}

let settle: ReturnType<typeof setTimeout> | undefined
function nudge() {
  moving.value = true
  clearTimeout(settle)
  settle = setTimeout(() => (moving.value = false), 200)
}

function onWheel(event: WheelEvent) {
  if (props.zoomable && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    const rect = rootRef.value!.getBoundingClientRect()
    // Pinches arrive as small deltas, mouse wheels as large ones.
    const delta = Math.max(-50, Math.min(50, event.deltaY))
    zoomAt(zoom.value * Math.exp(-delta / 200), event.clientX - rect.left, event.clientY - rect.top)
    nudge()
    return
  }
  if (!canPanX.value && !canPanY.value) return
  const horizontal = event.shiftKey && !event.deltaX
  const dx = horizontal ? event.deltaY : event.deltaX
  const dy = horizontal ? 0 : event.deltaY
  const before = [x.value, y.value]
  moveTo(canPanX.value ? x.value - dx : x.value, canPanY.value ? y.value - dy : y.value)
  // At an edge the page scrolls on.
  if (before[0] !== x.value || before[1] !== y.value) {
    event.preventDefault()
    nudge()
  }
}

// The box clips without scrollbars, yet the browser still scrolls it to
// bring a focused node or a find-in-page match into view. Turn that into
// a pan so the two never add up.
function onScroll() {
  const el = rootRef.value!
  if (!el.scrollLeft && !el.scrollTop) return
  const [left, top] = [el.scrollLeft, el.scrollTop]
  el.scrollLeft = 0
  el.scrollTop = 0
  moveTo(x.value - left, y.value - top)
}

const pointers = new Map<number, { x: number; y: number }>()
let drag: { x: number; y: number; startX: number; startY: number; moved: boolean } | null = null
let pinch: { distance: number; zoom: number } | null = null
const dragging = ref(false)

function distance() {
  const [a, b] = [...pointers.values()]
  return Math.hypot(a!.x - b!.x, a!.y - b!.y)
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || (event.target as Element).closest(`.${ns.e('toolbar')}`)) return
  // The first finger of a new touch: fingers still on record lifted unheard.
  if (event.isPrimary) {
    pointers.clear()
    pinch = null
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size === 2 && props.zoomable) {
    pinch = { distance: distance(), zoom: zoom.value }
    drag = null
    return
  }
  if (pointers.size === 1 && (canPanX.value || canPanY.value)) {
    drag = { x: event.clientX, y: event.clientY, startX: x.value, startY: y.value, moved: false }
  }
}

function onPointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    const rect = rootRef.value!.getBoundingClientRect()
    zoomAt(
      (pinch.zoom * distance()) / pinch.distance,
      (a!.x + b!.x) / 2 - rect.left,
      (a!.y + b!.y) / 2 - rect.top,
    )
    nudge()
    return
  }
  if (!drag) return
  const dx = event.clientX - drag.x
  const dy = event.clientY - drag.y
  // A short wobble is still a click.
  if (!drag.moved && Math.hypot(dx, dy) < 4) return
  if (!drag.moved) {
    drag.moved = true
    dragging.value = true
    rootRef.value?.setPointerCapture?.(event.pointerId)
  }
  moveTo(drag.startX + dx, drag.startY + dy)
  nudge()
}

function swallow(event: Event) {
  event.stopPropagation()
  event.preventDefault()
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId)
  if (pointers.size < 2) pinch = null
  if (drag?.moved) {
    // The press ended a drag, not a click on whatever is under it.
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
  }
  drag = null
  dragging.value = false
}

const canvasRef = ref<HTMLElement | null>(null)
const canvasStyle = computed<CSSProperties>(() => ({
  width: `${contentWidth.value}px`,
  height: `${contentHeight.value}px`,
}))
// Set straight on the element: a frame of panning re-renders no node.
const transform = computed(() => `translate(${x.value}px, ${y.value}px) scale(${zoom.value})`)
watch([canvasRef, transform], ([el, value]) => el && (el.style.transform = value), {
  flush: 'sync',
})
// Leave the page's own swipe alone along an axis the graph does not pan.
const touchAction = computed(() => {
  if (props.zoomable || (canPanX.value && canPanY.value)) return 'none'
  if (canPanX.value) return 'pan-y'
  if (canPanY.value) return 'pan-x'
  return undefined
})
const rootStyle = computed<CSSProperties>(() => {
  const height = props.height ?? contentHeight.value
  return {
    height: typeof height === 'number' ? `${height}px` : height,
    touchAction: touchAction.value,
  }
})

function fit() {
  const { width, height } = viewport.value
  if (!width) return
  const next = props.zoomable
    ? clampZoom(Math.min(1, width / contentWidth.value, height / contentHeight.value))
    : zoom.value
  zoom.value = next
  moveTo((width - contentWidth.value * next) / 2, (height - contentHeight.value * next) / 2)
}
function resetView() {
  zoom.value = 1
  moveTo(0, 0)
}
function zoomTo(value: number) {
  zoomAt(value)
}
function scrollToNode(id: string) {
  const node = layout.value.nodes.get(id)
  const { width, height } = viewport.value
  if (!node || !width) return
  const k = zoom.value
  const left = (node.x + PAD) * k + x.value
  const top = (node.y + PAD) * k + y.value
  const right = left + node.width * k
  const bottom = top + node.height * k
  let nextX = x.value
  let nextY = y.value
  if (left < 0 || right > width) nextX = x.value + width / 2 - (left + right) / 2
  if (top < 0 || bottom > height) nextY = y.value + height / 2 - (top + bottom) / 2
  moveTo(nextX, nextY)
}

// Keep the view inside bounds when anything changes size.
watch([contentWidth, contentHeight, viewport, zoom], () => moveTo(x.value, y.value))
watch(
  () => [props.minZoom, props.maxZoom],
  () => (zoom.value = clampZoom(zoom.value)),
)

let rootObserver: ResizeObserver | undefined
onMounted(() => {
  measure()
  // Known right away, so a parent's onMounted can already call fit().
  viewport.value = { width: rootRef.value!.clientWidth, height: rootRef.value!.clientHeight }
  if (typeof ResizeObserver !== 'undefined') {
    rootObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect
      viewport.value = { width, height }
    })
    rootObserver.observe(rootRef.value!)
    nodeObserver = new ResizeObserver(scheduleMeasure)
    for (const el of nodeEls.values()) nodeObserver.observe(el)
  }
  // Node widths are fixed once laid out, so a late web font would not
  // resize them: measure again whenever fonts finish loading.
  document.fonts?.ready.then(measure)
  document.fonts?.addEventListener?.('loadingdone', scheduleMeasure)
})
onBeforeUnmount(() => {
  document.fonts?.removeEventListener?.('loadingdone', scheduleMeasure)
  rootObserver?.disconnect()
  nodeObserver?.disconnect()
  cancelAnimationFrame(frame)
  clearTimeout(settle)
})

// Selection, hover and highlight --------------------------------------------

const selectedIds = computed(() => {
  const value = selected.value
  return new Set(value == null ? [] : Array.isArray(value) ? value : [value])
})

function select(node: GraphNode) {
  if (!props.selectable || node.disabled) return
  if (props.selectable === 'multiple') {
    const current = [...selectedIds.value]
    selected.value = current.includes(node.id)
      ? current.filter((id) => id !== node.id)
      : [...current, node.id]
  } else selected.value = node.id
}

const focus = computed(() => {
  if (props.highlight === 'hover') return hovered.value
  if (props.highlight === 'selected') return [...selectedIds.value][0] ?? null
  return null
})

function reach(start: string, next: Map<string, string[]>) {
  const seen = new Set<string>()
  const queue = [start]
  while (queue.length) {
    for (const id of next.get(queue.pop()!) ?? []) {
      if (seen.has(id)) continue
      seen.add(id)
      queue.push(id)
    }
  }
  return seen
}

const chain = computed(() => {
  const id = focus.value
  if (!id || !byId.value.has(id)) return null
  const up = reach(id, preds.value)
  const down = reach(id, succs.value)
  up.add(id)
  down.add(id)
  return { up, down }
})

const inChain = (id: string) => !chain.value || chain.value.up.has(id) || chain.value.down.has(id)
const edgeInChain = (from: string, to: string) =>
  !!chain.value &&
  ((chain.value.up.has(from) && chain.value.up.has(to)) ||
    (chain.value.down.has(from) && chain.value.down.has(to)))

function onEnter(node: GraphNode, event: PointerEvent) {
  hovered.value = node.id
  emit('nodeEnter', node, event.currentTarget as HTMLElement)
}
function onLeave(node: GraphNode, event: PointerEvent) {
  if (hovered.value === node.id) hovered.value = null
  emit('nodeLeave', node, event.currentTarget as HTMLElement)
}
function onClick(node: GraphNode, event: MouseEvent) {
  select(node)
  emit('nodeClick', node, event)
}

// Keyboard ------------------------------------------------------------------

const focused = ref<string | null>(null)
const tabbable = computed(() => {
  const ids = byId.value
  if (focused.value && ids.has(focused.value)) return focused.value
  const first = [...selectedIds.value].find((id) => ids.has(id))
  return first ?? layout.value.columns[0]?.[0] ?? null
})

/** The middle of a node across the flow. */
const across = (n: { x: number; y: number; width: number; height: number }) =>
  vertical.value ? n.x + n.width / 2 : n.y + n.height / 2

function nearest(ids: string[], from: string) {
  const nodes = layout.value.nodes
  const origin = across(nodes.get(from)!)
  let best: string | undefined
  let bestDistance = Infinity
  for (const id of ids) {
    const d = Math.abs(across(nodes.get(id)!) - origin)
    if (d < bestDistance) [best, bestDistance] = [id, d]
  }
  return best
}

function onKeydown(node: GraphNode, event: KeyboardEvent) {
  const placed = layout.value.nodes.get(node.id)!
  const column = layout.value.columns[placed.column]!
  const index = column.indexOf(node.id)
  // Along the flow to the next or previous node; across it within the rank.
  const [next, prev, after, before] = vertical.value
    ? ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft']
    : ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']
  let target: string | undefined
  switch (event.key) {
    case next:
      target = nearest(succs.value.get(node.id)!, node.id)
      break
    case prev:
      target = nearest(preds.value.get(node.id)!, node.id)
      break
    case after:
      target = column[index + 1]
      break
    case before:
      target = column[index - 1]
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      ;(event.currentTarget as HTMLElement).click()
      return
    default:
      return
  }
  event.preventDefault()
  if (!target) return
  focused.value = target
  nodeEls.get(target)?.focus({ preventScroll: true })
  scrollToNode(target)
}

// Rendering -----------------------------------------------------------------

function slotProps(node: GraphNode): GraphNodeSlotProps {
  return {
    node,
    status: statusOf(node),
    selected: selectedIds.value.has(node.id),
    hovered: hovered.value === node.id,
  }
}

function nodeLabel(node: GraphNode) {
  const sep = t('nodeGraph.separator')
  const parts = [node.label]
  if (node.kind === 'milestone') parts.push(t('nodeGraph.kind.milestone'))
  parts.push(t(`nodeGraph.status.${statusOf(node)}`))
  if (node.progress != null)
    parts.push(t('nodeGraph.progressValue', { value: Math.round(node.progress) }))
  if (node.incomplete) parts.push(t('nodeGraph.incomplete'))
  const deps = preds.value.get(node.id)!.map((id) => byId.value.get(id)!.label)
  if (deps.length) parts.push(t('nodeGraph.dependsOn', { list: deps.join(sep) }))
  return parts.join(sep)
}

function nodeStyle(node: GraphNode): CSSProperties {
  const placed = layout.value.nodes.get(node.id)
  if (!placed) return {}
  return {
    left: `${placed.x + PAD}px`,
    top: `${placed.y + PAD}px`,
    width: `${placed.width}px`,
    // Cards fill their rounded-up height, content centred.
    height: isCard(node) ? `${placed.height}px` : undefined,
    maxWidth: typeof props.nodeWidth === 'number' ? undefined : `${props.maxNodeWidth}px`,
  }
}

function nodeClasses(node: GraphNode) {
  const status = statusOf(node)
  return [
    ns.e('node'),
    `${ns.e('node')}--${isCard(node) ? 'card' : 'pill'}`,
    `is-${status}`,
    ns.is('milestone', node.kind === 'milestone'),
    ns.is('selected', selectedIds.value.has(node.id)),
    ns.is('hovered', hovered.value === node.id),
    ns.is('dimmed', !inChain(node.id)),
    ns.is('disabled', !!node.disabled),
    ns.is('selectable', !!props.selectable && !node.disabled),
  ]
}

const progressOf = (node: GraphNode) => Math.min(100, Math.max(0, Number(node.progress) || 0))

const edgeStatus = computed(() => {
  const map = new Map<string, GraphEdge['status']>()
  for (const e of props.edges) {
    const key = `${e.from}\u0000${e.to}`
    if (!map.has(key)) map.set(key, e.status)
  }
  return map
})

const edges = computed(() =>
  layout.value.edges.map((edge, i) => {
    const status = edgeStatus.value.get(`${edge.from}\u0000${edge.to}`)
    return {
      ...edge,
      key: `${edge.from}->${edge.to}-${i}`,
      classes: [
        ns.e('edge'),
        ns.is('active', status === 'active' || edgeInChain(edge.from, edge.to)),
        ns.is('muted', status === 'muted'),
        ns.is('dimmed', !!chain.value && !edgeInChain(edge.from, edge.to)),
      ],
    }
  }),
)

const hasToolbar = computed(() => props.zoomable || props.legend || !!slots.toolbar)
const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('vertical', vertical.value),
  ns.is('pannable', canPanX.value || canPanY.value),
  ns.is('dragging', dragging.value),
  ns.is('highlighting', !!chain.value),
])

defineExpose<NodeGraphExpose>({ scrollToNode, fit, zoomTo, resetView, relayout: measure })
</script>

<template>
  <div
    ref="rootRef"
    :class="classes"
    :style="rootStyle"
    role="group"
    :aria-label="ariaLabel ?? t('nodeGraph.label')"
    @wheel="onWheel"
    @scroll="onScroll"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div ref="canvasRef" :class="ns.e('canvas')" :style="canvasStyle">
      <svg :class="ns.e('edges')" :width="contentWidth" :height="contentHeight" aria-hidden="true">
        <g :transform="`translate(${PAD} ${PAD})`">
          <path v-for="edge in edges" :key="edge.key" :class="edge.classes" :d="edge.path" />
        </g>
      </svg>
      <component
        :is="slots.detail ? DouPopover : OnlyChild"
        v-for="node in nodes"
        :key="node.id"
        v-bind="
          slots.detail
            ? { trigger: 'hover', placement: 'top', disabled: moving || dragging, showDelay: 200 }
            : {}
        "
      >
        <div
          :ref="(el) => setNodeRef(node.id, el)"
          :class="nodeClasses(node)"
          :style="nodeStyle(node)"
          role="button"
          :tabindex="tabbable === node.id ? 0 : -1"
          :aria-label="nodeLabel(node)"
          :aria-pressed="selectable ? selectedIds.has(node.id) : undefined"
          :aria-disabled="node.disabled || undefined"
          @click="onClick(node, $event)"
          @dblclick="emit('nodeDblclick', node, $event)"
          @pointerenter="onEnter(node, $event)"
          @pointerleave="onLeave(node, $event)"
          @focus="focused = node.id"
          @keydown="onKeydown(node, $event)"
        >
          <slot name="node" v-bind="slotProps(node)">
            <div :class="ns.e('main')">
              <slot name="status" v-bind="slotProps(node)">
                <span
                  v-if="node.kind === 'milestone'"
                  :class="[ns.e('milestone'), `is-${statusOf(node)}`]"
                  aria-hidden="true"
                >
                  <FlagIcon />
                </span>
                <span v-else :class="[ns.e('dot'), `is-${statusOf(node)}`]" aria-hidden="true" />
              </slot>
              <span v-if="node.icon || slots.icon" :class="ns.e('icon')" aria-hidden="true">
                <slot name="icon" v-bind="slotProps(node)">
                  <component :is="node.icon" />
                </slot>
              </span>
              <span :class="ns.e('label')">
                <slot name="label" v-bind="slotProps(node)">{{ node.label }}</slot>
              </span>
              <span v-if="node.extra != null || slots.extra" :class="ns.e('extra')">
                <slot name="extra" v-bind="slotProps(node)">{{ node.extra }}</slot>
              </span>
            </div>
            <div
              v-if="isCard(node) && (node.description != null || slots.description)"
              :class="[
                ns.e('description'),
                node.descriptionTone && ns.is('toned', true),
                node.descriptionTone && `dou-node-graph__description--${node.descriptionTone}`,
              ]"
            >
              <slot name="description" v-bind="slotProps(node)">{{ node.description }}</slot>
            </div>
            <div v-if="node.progress != null" :class="ns.e('progress')" aria-hidden="true">
              <span :class="ns.e('progress-bar')" :style="{ width: `${progressOf(node)}%` }" />
            </div>
          </slot>
          <span v-if="node.incomplete" :class="ns.e('marker')" aria-hidden="true" />
          <span v-if="slots.corner" :class="ns.e('corner')" @click.stop @dblclick.stop>
            <slot name="corner" v-bind="slotProps(node)" />
          </span>
        </div>
        <template v-if="slots.detail" #content>
          <slot name="detail" v-bind="slotProps(node)" />
        </template>
      </component>
    </div>

    <div v-if="!nodes.length && slots.empty" :class="ns.e('empty')">
      <slot name="empty" />
    </div>

    <div v-if="hasToolbar" :class="ns.e('toolbar')">
      <slot name="toolbar" />
      <template v-if="zoomable">
        <button
          type="button"
          :class="ns.e('tool')"
          :disabled="zoom <= minZoom"
          :aria-label="t('nodeGraph.zoomOut')"
          @click="zoomAt(zoom / 1.25)"
        >
          <ZoomOutIcon />
        </button>
        <button
          type="button"
          :class="[ns.e('tool'), ns.e('zoom')]"
          :aria-label="t('nodeGraph.zoomLevel', { value: Math.round(zoom * 100) })"
          @click="resetView"
        >
          {{ Math.round(zoom * 100) }}%
        </button>
        <button
          type="button"
          :class="ns.e('tool')"
          :disabled="zoom >= maxZoom"
          :aria-label="t('nodeGraph.zoomIn')"
          @click="zoomAt(zoom * 1.25)"
        >
          <ZoomInIcon />
        </button>
        <button type="button" :class="ns.e('tool')" :aria-label="t('nodeGraph.fit')" @click="fit">
          <FocusIcon />
        </button>
      </template>
      <DouPopover v-if="legend" placement="bottom-end" trigger="click">
        <button type="button" :class="ns.e('tool')" :aria-label="t('nodeGraph.legend')">
          <InfoIcon />
        </button>
        <template #content>
          <slot name="legend">
            <DouNodeGraphLegend :nodes="shownNodes" />
          </slot>
        </template>
      </DouPopover>
    </div>
  </div>
</template>
