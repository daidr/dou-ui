<script setup lang="ts">
import { useReducedMotion } from 'dou-ui'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowReactive,
  shallowRef,
  toRaw,
  useTemplateRef,
  watch,
} from 'vue'
import type { CSSProperties } from 'vue'
import NodeView from './components/node-view.vue'
import { defaultNode } from './components/default-node'
import {
  flowEditorKey,
  type FlowEditorEmits,
  type FlowEditorExpose,
  type FlowEditorProps,
  type NodeMetrics,
  type PortAnchor,
  type PortState,
} from './context'
import {
  bezierPath,
  boundsOf,
  intersects,
  rectFrom,
  snapBox,
  type Guide,
  type SnapLink,
} from './core/geometry'
import { canJoin, primaryType, type FlowConnection, type PortTypeSpec } from './core/connect'
import { FlowHistory } from './core/history'
import { readClipboard, writeClipboard } from './core/clipboard'
import {
  createId,
  emptyDocument,
  emptySelection,
  type FlowDocument,
  type FlowEdge,
  type FlowEndpoint,
  type FlowNode,
  type FlowPortSpec,
  type FlowSelection,
  type FlowViewport,
  type Point,
  type Rect,
} from './core/model'
import { labelOf, portsOf, type NodeTypeSpec } from './core/node-types'
import { Transaction, type TransactionMeta } from './core/transaction'
import { format, useFlowMessages } from './locale'

defineOptions({ name: 'DouFlowEditor' })

const props = withDefaults(defineProps<FlowEditorProps>(), {
  grid: 8,
  guides: true,
  minZoom: 0.1,
  maxZoom: 4,
  fitView: false,
  readonly: false,
  panOnScroll: true,
})
const doc = defineModel<FlowDocument>({ default: emptyDocument })
const selection = defineModel<FlowSelection>('selection', { default: emptySelection })
const viewport = defineModel<FlowViewport>('viewport', {
  default: () => ({ x: 0, y: 0, zoom: 1 }),
})
const emit = defineEmits<FlowEditorEmits>()

const messages = useFlowMessages(() => props.messages)
const reducedMotion = useReducedMotion()
const root = useTemplateRef<HTMLElement>('root')

/** Movement in screen px before a press becomes a drag. */
const THRESHOLD = { mouse: 3, touch: 6 }
const LONG_PRESS = 500
/** How close to the edge a drag starts scrolling the canvas, in px. */
const EDGE = 24
/** Auto-scroll speed in px per frame, at `d` px from the edge. */
const edgeSpeed = (d: number) => (d < EDGE ? Math.min(1, (EDGE - d) / EDGE) * 12 : 0)

/** The axis that levels two ports on this side. */
const level = (side: string) => (side === 'left' || side === 'right' ? 'y' : 'x')

const same = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i])

// Node types --------------------------------------------------------------------

const types = computed(() => {
  const map = new Map<string, NodeTypeSpec>([['default', defaultNode as NodeTypeSpec]])
  for (const spec of props.nodeTypes ?? []) map.set(spec.type, spec as NodeTypeSpec)
  return map
})
const specOf = (node: FlowNode) =>
  types.value.get(node.type ?? 'default') ?? types.value.get('default')

function portSpec(end: FlowEndpoint) {
  const node = nodeById.value.get(end.node)
  if (!node || end.port == null) return undefined
  return portsOf(specOf(node), node).find((port) => port.id === end.port)
}

const portTypeOf = (port: FlowPortSpec): PortTypeSpec | undefined => {
  const type = primaryType(port)
  return type ? props.portTypes?.[type] : undefined
}

const tones = new Set(['neutral', 'primary', 'success', 'warning', 'danger'])
/** A port type's color as CSS: theme tones by name, anything else as is. */
const colorOf = (spec: PortTypeSpec | undefined) =>
  spec?.color ? (tones.has(spec.color) ? `var(--dou-color-${spec.color})` : spec.color) : undefined

// Document and history ------------------------------------------------------------

const history = new FlowHistory()
const canUndo = ref(false)
const canRedo = ref(false)
const syncHistory = () => {
  canUndo.value = history.canUndo
  canRedo.value = history.canRedo
}

function setSelection(next: FlowSelection) {
  const current = selection.value
  if (same(current.nodes, next.nodes) && same(current.edges, next.edges)) return
  selection.value = next
}

/** Drops selected ids that are no longer in the document. */
function pruneSelection(next: FlowDocument, sel = selection.value): FlowSelection {
  const nodes = new Set(next.nodes.map((n) => n.id))
  const edges = new Set(next.edges.map((e) => e.id))
  return {
    nodes: sel.nodes.filter((id) => nodes.has(id)),
    edges: sel.edges.filter((id) => edges.has(id)),
  }
}

function commit(tr: Transaction) {
  doc.value = tr.doc
  const removes = tr.steps.some((s) => s.type === 'removeNode' || s.type === 'removeEdge')
  if (removes) setSelection(pruneSelection(tr.doc))
  emit('change', tr)
}

function transact(fn: (tr: Transaction) => void, meta?: TransactionMeta) {
  const tr = new Transaction(toRaw(doc.value))
  if (meta) tr.setMeta(meta)
  fn(tr)
  if (!tr.changed) return tr
  const before = selection.value
  commit(tr)
  history.record(tr, before, selection.value)
  syncHistory()
  return tr
}

function undo() {
  const result = history.undo(toRaw(doc.value))
  if (!result) return false
  result.tr.setMeta({ origin: 'undo', history: false })
  commit(result.tr)
  setSelection(pruneSelection(result.tr.doc, result.selection))
  syncHistory()
  announce(messages.value.undone)
  return true
}

function redo() {
  const result = history.redo(toRaw(doc.value))
  if (!result) return false
  result.tr.setMeta({ origin: 'redo', history: false })
  commit(result.tr)
  setSelection(pruneSelection(result.tr.doc, result.selection))
  syncHistory()
  announce(messages.value.redone)
  return true
}

// Measuring ----------------------------------------------------------------------

const metrics = shallowReactive(new Map<string, NodeMetrics>())
const nodeById = computed(() => new Map(doc.value.nodes.map((node) => [node.id, node])))

function onMeasure(id: string, value: NodeMetrics) {
  metrics.set(id, value)
}

// Forget nodes that are gone.
watch(nodeById, (nodes) => {
  for (const id of metrics.keys()) if (!nodes.has(id)) metrics.delete(id)
})

function rectOf(node: FlowNode): Rect {
  const m = metrics.get(node.id)
  return {
    x: node.x,
    y: node.y,
    width: m?.width ?? node.width ?? 0,
    height: m?.height ?? node.height ?? 0,
  }
}

function getNodeRect(id: string) {
  const node = nodeById.value.get(id)
  return node ? rectOf(node) : null
}

// Edges ----------------------------------------------------------------------------

function anchor(node: FlowNode, port: string | undefined, role: 'source' | 'target') {
  const m = metrics.get(node.id)
  if (!m) return null
  const at: PortAnchor | undefined = port ? m.ports.get(port) : undefined
  if (at) return { x: node.x + at.x, y: node.y + at.y, side: at.side }
  return role === 'source'
    ? { x: node.x + m.width, y: node.y + m.height / 2, side: 'right' as const }
    : { x: node.x, y: node.y + m.height / 2, side: 'left' as const }
}

function anchorOf(end: FlowEdge['source'], role: 'source' | 'target') {
  const node = nodeById.value.get(end.node)
  return node ? anchor(node, end.port, role) : null
}

const edgePaths = computed(() => {
  const selected = new Set(selection.value.edges)
  const moving = connecting.value?.edge
  const out: { edge: FlowEdge; path: string; selected: boolean; style?: CSSProperties }[] = []
  for (const edge of doc.value.edges) {
    if (edge.id === moving) continue
    const source = nodeById.value.get(edge.source.node)
    const target = nodeById.value.get(edge.target.node)
    if (!source || !target) continue
    const a = anchor(source, edge.source.port, 'source')
    const b = anchor(target, edge.target.port, 'target')
    if (!a || !b) continue
    out.push({
      edge,
      path: bezierPath(a, a.side, b, b.side),
      selected: selected.has(edge.id),
      style: edgeStyle(edge),
    })
  }
  return out
})

function edgeStyle(edge: FlowEdge): CSSProperties | undefined {
  const port = portSpec(edge.source)
  const type = port && portTypeOf(port)
  if (!type) return undefined
  return {
    '--dou-flow-editor-edge': colorOf(type),
    '--dou-flow-editor-edge-width': type.edgeWidth ? `${type.edgeWidth}px` : undefined,
    strokeDasharray: type.dashed ? '4 4' : undefined,
  } as CSSProperties
}

/** Connected port ids, by node. */
const connected = computed(() => {
  const map = new Map<string, Set<string>>()
  const add = (node: string, port?: string) => {
    if (!port) return
    let set = map.get(node)
    if (!set) map.set(node, (set = new Set()))
    set.add(port)
  }
  for (const edge of doc.value.edges) {
    add(edge.source.node, edge.source.port)
    add(edge.target.node, edge.target.port)
  }
  return map
})
const none = new Set<string>()
const noStates = new Map<string, PortState>()

function describe(node: FlowNode) {
  const ports = portsOf(specOf(node), node)
  if (!ports.length) return ''
  return format(messages.value.ports, {
    inputs: ports.filter((p) => p.kind === 'input').length,
    outputs: ports.filter((p) => p.kind === 'output').length,
    connected: doc.value.edges.filter((e) => e.source.node === node.id || e.target.node === node.id)
      .length,
  })
}

// Viewport -------------------------------------------------------------------------

const clampZoom = (zoom: number) => Math.min(props.maxZoom, Math.max(props.minZoom, zoom))

let animation = 0
function stopAnimation() {
  cancelAnimationFrame(animation)
  animation = 0
}

function setViewport(next: FlowViewport, animate = false) {
  stopAnimation()
  if (!animate || reducedMotion.value || typeof requestAnimationFrame === 'undefined') {
    viewport.value = next
    return
  }
  const from = { ...viewport.value }
  const start = performance.now()
  const duration = 240
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    const e = 1 - (1 - t) ** 3
    viewport.value = {
      x: from.x + (next.x - from.x) * e,
      y: from.y + (next.y - from.y) * e,
      zoom: from.zoom + (next.zoom - from.zoom) * e,
    }
    animation = t < 1 ? requestAnimationFrame(frame) : 0
  }
  animation = requestAnimationFrame(frame)
}

/** Point on the screen relative to the editor's top left corner. */
function local(clientX: number, clientY: number): Point {
  const rect = root.value!.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

function toCanvas(point: Point): Point {
  const p = local(point.x, point.y)
  const { x, y, zoom } = viewport.value
  return { x: (p.x - x) / zoom, y: (p.y - y) / zoom }
}

/** Zooms keeping the canvas point under `at` (local px) in place. */
function zoomAround(zoom: number, at: Point, animate = false) {
  const { x, y, zoom: k } = viewport.value
  const next = clampZoom(zoom)
  const cx = (at.x - x) / k
  const cy = (at.y - y) / k
  setViewport({ x: at.x - cx * next, y: at.y - cy * next, zoom: next }, animate)
}

const center = () => ({ x: root.value!.clientWidth / 2, y: root.value!.clientHeight / 2 })
const zoomTo = (zoom: number) => zoomAround(zoom, center(), true)
const zoomIn = () => zoomTo(viewport.value.zoom * 1.25)
const zoomOut = () => zoomTo(viewport.value.zoom / 1.25)

/** Room left around the nodes when fitting them into view. */
const FIT_PADDING = 40

function fit(ids?: string[], animate = true) {
  if (!root.value) return
  const nodes = ids ? ids.map((id) => nodeById.value.get(id)!).filter(Boolean) : doc.value.nodes
  const bounds = boundsOf(nodes.map(rectOf))
  if (!bounds) return
  const width = root.value.clientWidth
  const height = root.value.clientHeight
  const zoom = clampZoom(
    Math.min(
      (width - FIT_PADDING * 2) / Math.max(1, bounds.width),
      (height - FIT_PADDING * 2) / Math.max(1, bounds.height),
      1,
    ),
  )
  setViewport(
    {
      x: Math.round((width - bounds.width * zoom) / 2 - bounds.x * zoom),
      y: Math.round((height - bounds.height * zoom) / 2 - bounds.y * zoom),
      zoom,
    },
    animate,
  )
}

function centerNode(id: string) {
  const rect = getNodeRect(id)
  if (!rect || !root.value) return
  const { zoom } = viewport.value
  const c = center()
  setViewport(
    {
      x: c.x - (rect.x + rect.width / 2) * zoom,
      y: c.y - (rect.y + rect.height / 2) * zoom,
      zoom,
    },
    true,
  )
}

/** Keeps a node in view, e.g. when it gets keyboard focus. */
function reveal(id: string) {
  const rect = getNodeRect(id)
  if (!rect || !root.value) return
  const { x, y, zoom } = viewport.value
  const pad = 16
  const left = rect.x * zoom + x
  const top = rect.y * zoom + y
  const right = left + rect.width * zoom
  const bottom = top + rect.height * zoom
  const w = root.value.clientWidth
  const h = root.value.clientHeight
  let dx = 0
  let dy = 0
  if (left < pad) dx = pad - left
  else if (right > w - pad) dx = Math.max(pad - left, w - pad - right)
  if (top < pad) dy = pad - top
  else if (bottom > h - pad) dy = Math.max(pad - top, h - pad - bottom)
  if (dx || dy) setViewport({ x: x + dx, y: y + dy, zoom }, true)
}

// Fit once every node has been measured.
let fitted = !props.fitView
watch(
  () => metrics.size,
  (size) => {
    if (fitted || !size || size < doc.value.nodes.length) return
    fitted = true
    fit(undefined, false)
  },
)

/** Dots every 16 canvas px, spread out further when zoomed out. */
const background = computed<CSSProperties>(() => {
  const { x, y, zoom } = viewport.value
  let gap = 16
  while (gap * zoom < 12) gap *= 2
  const size = gap * zoom
  return {
    backgroundSize: `${size}px ${size}px`,
    backgroundPosition: `${x - size / 2}px ${y - size / 2}px`,
  }
})

const layerStyle = computed<CSSProperties>(() => {
  const { x, y, zoom } = viewport.value
  return { transform: `translate(${x}px, ${y}px) scale(${zoom})` }
})

// Pointer gestures ------------------------------------------------------------------

type Gesture =
  | {
      kind: 'pan'
      id: number
      touch: boolean
      start: Point
      origin: FlowViewport
      moved: boolean
      additive: boolean
    }
  | {
      kind: 'box'
      id: number
      start: Point
      current: Point
      client: Point
      base: FlowSelection
    }
  | {
      kind: 'drag'
      id: number
      touch: boolean
      node: string
      start: Point
      client: Point
      origins: Map<string, Point>
      others: Rect[]
      /** Ports on moving nodes connected to ports on standing ones. */
      links: SnapLink[]
      started: boolean
      additive: boolean
      wasSelected: boolean
      held: boolean
      group: string
      snap: boolean
    }
  | {
      kind: 'connect'
      id: number
      touch: boolean
      /** The pressed node, selected on a plain click. */
      node: string
      start: Point
      client: Point
      started: boolean
      link: Link
    }

/** An edge being drawn: one end stays, the other follows the pointer. */
interface Link {
  fixed: Required<FlowEndpoint>
  /** Which end of the edge is moving. */
  moving: 'source' | 'target'
  /** An existing edge being moved to another port. */
  edge?: string
  /** Where the moving end is, in canvas coordinates. */
  point: Point
  candidate: Required<FlowEndpoint> | null
  /** Ports the moving end may land on: port ids by node. */
  valid: Map<string, Set<string>>
}

const gesture = shallowRef<Gesture | null>(null)
const guides = shallowRef<Guide[]>([])
const panning = ref(false)
const spaceHeld = ref(false)
let pressTimer = 0
let dragCount = 0

/** Active touch points, for pinching. */
const touches = new Map<number, Point>()
let pinch: { distance: number; mid: Point; origin: FlowViewport } | null = null

const isInteractive = (el: Element) =>
  !!el.closest(
    'input, textarea, select, button, a[href], [contenteditable=""], [contenteditable="true"], [data-flow-nodrag]',
  )
const inPanels = (el: Element) => !!el.closest('.dou-flow-editor__panels > *')

/** Keeps receiving a pointer's events once it leaves the editor. */
function capture(id: number) {
  try {
    root.value!.setPointerCapture(id)
  } catch {
    // The pointer is already gone.
  }
}

function clearPress() {
  clearTimeout(pressTimer)
  pressTimer = 0
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as Element
  if (inPanels(target)) return
  stopAnimation()
  const touch = event.pointerType === 'touch'
  if (touch) {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touches.size === 2) {
      startPinch()
      return
    }
    if (touches.size > 2) return
  }
  if (gesture.value) return

  const nodeEl = target.closest<HTMLElement>('[data-node-id]')
  const edgeEl = target.closest<Element>('[data-edge-id]')
  const additive = event.shiftKey || event.metaKey || event.ctrlKey
  const client = { x: event.clientX, y: event.clientY }

  if (event.button === 1 || (event.button === 0 && spaceHeld.value)) {
    event.preventDefault()
    startPan(event, false)
    return
  }
  if (event.button !== 0) return

  const portEl = target.closest<HTMLElement>('.dou-flow-port')
  if (nodeEl && portEl && !props.readonly) {
    const link = linkFrom({ node: nodeEl.dataset.nodeId!, port: portEl.dataset.port! })
    if (link) {
      gesture.value = {
        kind: 'connect',
        id: event.pointerId,
        touch,
        node: nodeEl.dataset.nodeId!,
        start: client,
        client,
        started: false,
        link,
      }
      capture(event.pointerId)
      return
    }
  }

  if (nodeEl) {
    if (isInteractive(target)) return
    const id = nodeEl.dataset.nodeId!
    const wasSelected = selection.value.nodes.includes(id)
    if (!wasSelected) {
      setSelection(
        additive
          ? { nodes: [...selection.value.nodes, id], edges: selection.value.edges }
          : { nodes: [id], edges: [] },
      )
    }
    gesture.value = {
      kind: 'drag',
      id: event.pointerId,
      touch,
      node: id,
      start: toCanvas(client),
      client,
      origins: new Map(),
      others: [],
      links: [],
      started: false,
      additive,
      wasSelected,
      held: false,
      group: '',
      snap: !event.altKey,
    }
    if (touch) {
      // Holding a node adds it to the selection, without dragging.
      pressTimer = window.setTimeout(() => {
        const g = gesture.value
        if (g?.kind !== 'drag' || g.started) return
        g.held = true
        if (!selection.value.nodes.includes(id))
          setSelection({ nodes: [...selection.value.nodes, id], edges: selection.value.edges })
      }, LONG_PRESS)
    }
    capture(event.pointerId)
    return
  }

  if (edgeEl) {
    const id = edgeEl.getAttribute('data-edge-id')!
    const has = selection.value.edges.includes(id)
    if (additive)
      setSelection({
        nodes: selection.value.nodes,
        edges: has ? selection.value.edges.filter((e) => e !== id) : [...selection.value.edges, id],
      })
    else setSelection({ nodes: [], edges: [id] })
    const edge = doc.value.edges.find((e) => e.id === id)
    if (edge) emit('edge-click', edge, event)
    root.value!.focus({ preventScroll: true })
    return
  }

  if (event.shiftKey && !touch) startBox(event, client)
  else startPan(event, touch, additive)
}

function startPan(event: PointerEvent, touch: boolean, additive = false) {
  gesture.value = {
    kind: 'pan',
    id: event.pointerId,
    touch,
    start: { x: event.clientX, y: event.clientY },
    origin: { ...viewport.value },
    moved: false,
    additive,
  }
  if (touch) {
    // Holding the empty canvas starts a selection box instead.
    pressTimer = window.setTimeout(() => {
      const g = gesture.value
      if (g?.kind !== 'pan' || g.moved) return
      startBox(event, g.start)
    }, LONG_PRESS)
  }
  capture(event.pointerId)
}

function startBox(event: PointerEvent, client: Point) {
  const start = toCanvas(client)
  gesture.value = {
    kind: 'box',
    id: event.pointerId,
    start,
    current: start,
    client,
    base: event.shiftKey ? selection.value : emptySelection(),
  }
  capture(event.pointerId)
}

function startPinch() {
  const [a, b] = [...touches.values()] as [Point, Point]
  clearPress()
  endGesture()
  pinch = {
    distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    mid: local((a.x + b.x) / 2, (a.y + b.y) / 2),
    origin: { ...viewport.value },
  }
}

function movePinch() {
  if (!pinch) return
  const [a, b] = [...touches.values()] as [Point, Point]
  const { origin } = pinch
  const zoom = clampZoom((origin.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance)
  const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2)
  // The canvas point under the fingers' first midpoint follows the midpoint.
  const cx = (pinch.mid.x - origin.x) / origin.zoom
  const cy = (pinch.mid.y - origin.y) / origin.zoom
  setViewport({ x: mid.x - cx * zoom, y: mid.y - cy * zoom, zoom })
}

/** Where the pointer is over the editor, for pasting under it. */
let hover: Point | null = null

function onPointerMove(event: PointerEvent) {
  if (event.pointerType === 'mouse') hover = { x: event.clientX, y: event.clientY }
  if (event.pointerType === 'touch' && touches.has(event.pointerId)) {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinch) {
      movePinch()
      return
    }
  }
  const g = gesture.value
  if (!g || g.id !== event.pointerId) return
  const client = { x: event.clientX, y: event.clientY }
  if (g.kind === 'pan') {
    const dx = client.x - g.start.x
    const dy = client.y - g.start.y
    if (!g.moved) {
      if (Math.hypot(dx, dy) < THRESHOLD[g.touch ? 'touch' : 'mouse']) return
      g.moved = true
      clearPress()
      panning.value = true
    }
    setViewport({ x: g.origin.x + dx, y: g.origin.y + dy, zoom: g.origin.zoom })
  } else if (g.kind === 'box') {
    g.client = client
    updateBox(g)
    autoPan(client)
  } else if (g.kind === 'connect') {
    g.client = client
    if (!g.started) {
      if (
        Math.hypot(client.x - g.start.x, client.y - g.start.y) <
        THRESHOLD[g.touch ? 'touch' : 'mouse']
      )
        return
      g.started = true
    }
    updateLink(g)
    autoPan(client)
  } else {
    g.client = client
    if (!g.started) {
      const { zoom } = viewport.value
      const p = toCanvas(client)
      const moved = Math.hypot(p.x - g.start.x, p.y - g.start.y) * zoom
      if (moved < THRESHOLD[g.touch ? 'touch' : 'mouse'] || g.held) return
      clearPress()
      if (props.readonly) return
      startDrag(g)
    }
    g.snap = !event.altKey
    moveDrag(g)
    autoPan(client)
  }
}

function updateBox(g: Extract<Gesture, { kind: 'box' }>) {
  g.current = toCanvas(g.client)
  const box = rectFrom(g.start, g.current)
  const hit = doc.value.nodes.filter((node) => intersects(box, rectOf(node))).map((n) => n.id)
  const nodes = [...new Set([...g.base.nodes, ...hit])]
  setSelection({ nodes, edges: g.base.edges })
  gesture.value = { ...g }
}

function startDrag(g: Extract<Gesture, { kind: 'drag' }>) {
  g.started = true
  g.group = `drag:${++dragCount}`
  const moving = new Set(selection.value.nodes)
  for (const node of doc.value.nodes) {
    if (moving.has(node.id) && !node.locked) g.origins.set(node.id, { x: node.x, y: node.y })
  }
  g.others = doc.value.nodes.filter((node) => !moving.has(node.id)).map(rectOf)
  for (const edge of doc.value.edges) {
    const fromSource = g.origins.has(edge.source.node)
    if (fromSource === g.origins.has(edge.target.node)) continue
    const [mine, theirs] = fromSource ? [edge.source, edge.target] : [edge.target, edge.source]
    const a = anchorOf(mine, fromSource ? 'source' : 'target')
    const b = anchorOf(theirs, fromSource ? 'target' : 'source')
    if (a && b && level(a.side) === level(b.side))
      g.links.push({ from: a, to: b, axis: level(a.side) })
  }
  gesture.value = { ...g }
}

function moveDrag(g: Extract<Gesture, { kind: 'drag' }>) {
  if (!g.origins.size) return
  const p = toCanvas(g.client)
  const dx = p.x - g.start.x
  const dy = p.y - g.start.y
  const moved = boundsOf(
    [...g.origins].map(([id, o]) => {
      const rect = getNodeRect(id)!
      return { ...rect, x: o.x + dx, y: o.y + dy }
    }),
  )!
  const snap = g.snap
    ? snapBox(moved, props.guides ? g.others : [], {
        threshold: 6 / viewport.value.zoom,
        grid: props.grid,
        links: props.guides
          ? g.links.map((link) => ({ ...link, from: { x: link.from.x + dx, y: link.from.y + dy } }))
          : [],
      })
    : { dx: 0, dy: 0, guides: [] }
  const sx = dx + snap.dx
  const sy = dy + snap.dy
  transact(
    (tr) => {
      for (const [id, o] of g.origins) tr.moveNode(id, Math.round(o.x + sx), Math.round(o.y + sy))
    },
    { group: g.group },
  )
  guides.value = snap.guides
}

let autoPanFrame = 0
/** Scrolls the canvas while a drag or a selection box nears its edge. */
function autoPan(client: Point) {
  cancelAnimationFrame(autoPanFrame)
  const el = root.value
  if (!el) return
  const p = local(client.x, client.y)
  const vx = edgeSpeed(p.x) - edgeSpeed(el.clientWidth - p.x)
  const vy = edgeSpeed(p.y) - edgeSpeed(el.clientHeight - p.y)
  if (!vx && !vy) return
  const step = () => {
    const g = gesture.value
    if (!g || g.kind === 'pan' || ((g.kind === 'drag' || g.kind === 'connect') && !g.started))
      return
    const { x, y, zoom } = viewport.value
    viewport.value = { x: x + vx, y: y + vy, zoom }
    if (g.kind === 'box') updateBox(g)
    else if (g.kind === 'connect') updateLink(g)
    else moveDrag(g)
    autoPanFrame = requestAnimationFrame(step)
  }
  autoPanFrame = requestAnimationFrame(step)
}

// Connecting ---------------------------------------------------------------------

const connectOptions = () => ({
  portTypes: props.portTypes,
  acyclic: props.acyclic,
  canConnect: props.canConnect,
})

/**
 * Starts an edge at a port. From an output, or an empty input, it draws a
 * new edge; from an input that has an edge, it picks that edge up.
 */
function linkFrom(at: Required<FlowEndpoint>): Link | null {
  const port = portSpec(at)
  if (!port) return null
  let link: Omit<Link, 'valid'>
  let taken: FlowEdge | undefined
  if (port.kind === 'input')
    for (const e of doc.value.edges)
      if (e.target.node === at.node && e.target.port === at.port) taken = e
  if (taken && taken.source.port != null) {
    link = {
      fixed: taken.source as Required<FlowEndpoint>,
      moving: 'target',
      edge: taken.id,
      point: anchorOf(at, 'target') ?? { x: 0, y: 0 },
      candidate: at,
    }
  } else {
    link = {
      fixed: at,
      moving: port.kind === 'output' ? 'target' : 'source',
      point: anchorOf(at, port.kind === 'output' ? 'source' : 'target') ?? { x: 0, y: 0 },
      candidate: null,
    }
  }
  return { ...link, valid: validEnds(link) }
}

const connectionOf = (link: Pick<Link, 'fixed' | 'moving'>, end: Required<FlowEndpoint>) =>
  (link.moving === 'target'
    ? { source: link.fixed, target: end }
    : { source: end, target: link.fixed }) as FlowConnection

function validEnds(link: Pick<Link, 'fixed' | 'moving' | 'edge'>) {
  const valid = new Map<string, Set<string>>()
  const fixedPort = portSpec(link.fixed)
  if (!fixedPort) return valid
  const options = connectOptions()
  for (const node of doc.value.nodes) {
    const ids = new Set<string>()
    for (const port of portsOf(specOf(node), node)) {
      const connection = connectionOf(link, { node: node.id, port: port.id })
      const ports =
        link.moving === 'target'
          ? { source: fixedPort, target: port }
          : { source: port, target: fixedPort }
      if (canJoin(toRaw(doc.value), connection, ports, options, link.edge)) ids.add(port.id)
    }
    if (ids.size) valid.set(node.id, ids)
  }
  return valid
}

/** How close, in screen px, the pointer must come to a port to snap to it. */
const MAGNET = 24

function updateLink(g: Extract<Gesture, { kind: 'connect' }>) {
  const link = g.link
  const point = toCanvas(g.client)
  const radius = (g.touch ? MAGNET * 1.5 : MAGNET) / viewport.value.zoom
  let best: { end: Required<FlowEndpoint>; d: number } | null = null
  const consider = (node: string, port: string, limit: number) => {
    const at = anchorOf({ node, port }, link.moving)
    if (!at) return
    const d = Math.hypot(at.x - point.x, at.y - point.y)
    if (d <= limit && (!best || d < best.d)) best = { end: { node, port }, d }
  }
  for (const [node, ports] of link.valid) for (const port of ports) consider(node, port, radius)
  // Dropping anywhere on a node picks its nearest free port.
  if (!best) {
    const over = document
      .elementFromPoint(g.client.x, g.client.y)
      ?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
    for (const port of (over && link.valid.get(over)) || []) consider(over!, port, Infinity)
  }
  g.link = {
    ...link,
    point,
    candidate: (best as { end: Required<FlowEndpoint> } | null)?.end ?? null,
  }
  gesture.value = { ...g }
}

/** Adds the edge a link describes, replacing what it must. */
function finishLink(link: Link, event?: MouseEvent) {
  const { candidate } = link
  if (!candidate) {
    if (link.edge) {
      // Dropping a picked-up edge on nothing removes it.
      const id = link.edge
      transact((tr) => tr.removeEdge(id))
    } else if (event) {
      emit('connect-end', link.fixed, link.point, event)
    }
    return
  }
  const connection = connectionOf(link, candidate)
  const target = portSpec(connection.target)
  const edge: FlowEdge = { id: createId('e'), source: connection.source, target: connection.target }
  transact((tr) => {
    if (link.edge) tr.removeEdge(link.edge)
    if ((target?.max ?? 1) === 1) {
      for (const old of tr.edgesOf(connection.target.node))
        if (
          old.target.node === connection.target.node &&
          old.target.port === connection.target.port
        )
          tr.removeEdge(old.id)
    }
    tr.addEdge(edge)
  })
  emit('connect', edge)
  announce(messages.value.connected)
}

/** What the canvas shows while an edge is being drawn, by mouse, touch or keyboard. */
const connecting = computed<Link | null>(() => {
  const g = gesture.value
  if (g?.kind === 'connect' && g.started) return g.link
  return keyLink.value
})

const previewPath = computed(() => {
  const link = connecting.value
  if (!link) return null
  const fixedRole = link.moving === 'target' ? 'source' : 'target'
  const a = anchorOf(link.fixed, fixedRole)
  if (!a) return null
  const c = link.candidate && anchorOf(link.candidate, link.moving)
  const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' } as const
  const b = c ?? { ...link.point, side: opposite[a.side] }
  return link.moving === 'target'
    ? bezierPath(a, a.side, b, b.side)
    : bezierPath(b, b.side, a, a.side)
})

/** How each port looks while connecting: by node, then port. */
const portStates = computed(() => {
  const link = connecting.value
  if (!link) return null
  const states = new Map<string, Map<string, PortState>>()
  const set = (end: Required<FlowEndpoint>, state: PortState) => {
    let ports = states.get(end.node)
    if (!ports) states.set(end.node, (ports = new Map()))
    ports.set(end.port, state)
  }
  for (const [node, ports] of link.valid) for (const port of ports) set({ node, port }, 'valid')
  set(link.fixed, 'active')
  if (link.candidate) set(link.candidate, 'candidate')
  return states
})

// Connecting from the keyboard: C on a selected node, arrows pick the port.

const keyLink = shallowRef<
  (Link & { from: Required<FlowEndpoint>; options: Required<FlowEndpoint>[] }) | null
>(null)

/** Valid ends of a link, nearest first. */
/** A port's anchor; nodes not measured yet fall back to their corner. */
function place(end: Required<FlowEndpoint>, role: 'source' | 'target') {
  return anchorOf(end, role) ?? nodeById.value.get(end.node) ?? { x: 0, y: 0 }
}

function rankEnds(link: Link) {
  const at = place(link.fixed, link.moving === 'target' ? 'source' : 'target')
  const ends: { end: Required<FlowEndpoint>; d: number }[] = []
  for (const [node, ports] of link.valid)
    for (const port of ports) {
      const p = place({ node, port }, link.moving)
      ends.push({ end: { node, port }, d: Math.hypot(p.x - at.x, p.y - at.y) })
    }
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh list
  return ends.sort((a, b) => a.d - b.d).map((e) => e.end)
}

function describeEnd(end: Required<FlowEndpoint>) {
  const node = nodeById.value.get(end.node)
  const port = portSpec(end)
  const name = node ? labelOf(specOf(node), node) : end.node
  return format(messages.value.connectTo, { node: name, port: port?.label ?? port?.id ?? '' })
}

/** Starts keyboard connecting from the next port of a node that has somewhere to go. */
function startKeyLink(nodeId: string, after?: Required<FlowEndpoint>) {
  const node = nodeById.value.get(nodeId)
  if (!node) return false
  // Outputs first: drawing a new edge is more common than moving one.
  const all = portsOf(specOf(node), node)
  const ports = [
    ...all.filter((p) => p.kind === 'output'),
    ...all.filter((p) => p.kind !== 'output'),
  ]
  const start = after ? ports.findIndex((p) => p.id === after.port) + 1 : 0
  for (let i = 0; i < ports.length; i++) {
    const port = ports[(start + i) % ports.length]!
    const link = linkFrom({ node: nodeId, port: port.id })
    if (!link) continue
    const options = rankEnds(link)
    if (!options.length) continue
    const candidate = link.edge ? link.candidate : options[0]!
    keyLink.value = { ...link, candidate, from: { node: nodeId, port: port.id }, options }
    if (candidate) {
      reveal(candidate.node)
      announce(describeEnd(candidate))
    }
    return true
  }
  announce(messages.value.noTarget)
  return false
}

function onKeyLink(event: KeyboardEvent) {
  const link = keyLink.value!
  const { options } = link
  const index = link.candidate
    ? options.findIndex((o) => o.node === link.candidate!.node && o.port === link.candidate!.port)
    : -1
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowUp': {
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
      const candidate = options[(index + step + options.length) % options.length]!
      keyLink.value = { ...link, candidate }
      reveal(candidate.node)
      announce(describeEnd(candidate))
      break
    }
    case 'Tab':
      startKeyLink(link.from.node, link.from)
      break
    case 'Enter':
      keyLink.value = null
      finishLink(link)
      break
    case 'Escape':
      keyLink.value = null
      break
    default:
      return
  }
  event.preventDefault()
}

// Clipboard ------------------------------------------------------------------------

/** The selected nodes and the edges between them. */
function copySelection(): FlowDocument | null {
  const ids = new Set(selection.value.nodes)
  if (!ids.size) return null
  const raw = toRaw(doc.value)
  return {
    nodes: raw.nodes.filter((node) => ids.has(node.id)),
    edges: raw.edges.filter((edge) => ids.has(edge.source.node) && ids.has(edge.target.node)),
  }
}

let pastes = 0

/** Adds a copy of `data` with new ids, at the pointer or next to the original. */
function paste(data: FlowDocument, at?: Point | null) {
  const bounds = boundsOf(
    data.nodes.map((n) => ({ x: n.x, y: n.y, width: n.width ?? 0, height: n.height ?? 0 })),
  )
  if (!bounds) return
  const step = (props.grid || 8) * 3
  const shift = at
    ? { x: Math.round(at.x - bounds.x), y: Math.round(at.y - bounds.y) }
    : { x: step * ++pastes, y: step * pastes }
  const ids = new Map(data.nodes.map((n) => [n.id, createId()]))
  // Shallow copies: documents are never changed in place.
  const nodes = data.nodes.map((n) => ({
    ...n,
    data: n.data && { ...n.data },
    id: ids.get(n.id)!,
    x: n.x + shift.x,
    y: n.y + shift.y,
    locked: undefined,
  }))
  transact((tr) => {
    for (const node of nodes) tr.addNode(node)
    for (const edge of data.edges) {
      const source = ids.get(edge.source.node)
      const target = ids.get(edge.target.node)
      if (!source || !target) continue
      tr.addEdge({
        ...edge,
        id: createId('e'),
        source: { ...edge.source, node: source },
        target: { ...edge.target, node: target },
      })
    }
  })
  setSelection({ nodes: nodes.map((n) => n.id), edges: [] })
}

function onPointerUp(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    touches.delete(event.pointerId)
    if (pinch) {
      if (touches.size < 2) pinch = null
      return
    }
  }
  const g = gesture.value
  if (!g || g.id !== event.pointerId) return
  const cancelled = event.type === 'pointercancel'
  if (!cancelled) {
    if (g.kind === 'pan' && !g.moved) {
      if (!g.additive) setSelection(emptySelection())
      emit('canvas-click', toCanvas({ x: event.clientX, y: event.clientY }), event)
    } else if (g.kind === 'connect') {
      if (g.started) finishLink(g.link, event)
      else setSelection({ nodes: [g.node], edges: [] })
    } else if (g.kind === 'drag' && !g.started && !g.held) {
      const node = nodeById.value.get(g.node)
      if (g.additive && g.wasSelected)
        setSelection({
          nodes: selection.value.nodes.filter((id) => id !== g.node),
          edges: selection.value.edges,
        })
      else if (!g.additive && g.wasSelected) setSelection({ nodes: [g.node], edges: [] })
      if (node) emit('node-click', node, event)
    }
  }
  endGesture()
}

function endGesture() {
  const g = gesture.value
  clearPress()
  cancelAnimationFrame(autoPanFrame)
  if (g && root.value?.hasPointerCapture(g.id)) root.value.releasePointerCapture(g.id)
  if (g?.kind === 'drag' && g.started) history.close()
  gesture.value = null
  guides.value = []
  panning.value = false
}

/** Puts dragged nodes back where they started. */
function cancelDrag() {
  const g = gesture.value
  if (g?.kind !== 'drag' || !g.started) return false
  const tr = new Transaction(toRaw(doc.value)).setMeta({ history: false })
  for (const [id, o] of g.origins) tr.moveNode(id, o.x, o.y)
  if (tr.changed) commit(tr)
  history.drop(g.group)
  syncHistory()
  endGesture()
  return true
}

function onWheel(event: WheelEvent) {
  const target = event.target as Element
  if (inPanels(target)) return
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.value!.clientHeight : 1
  let dx = event.deltaX * unit
  let dy = event.deltaY * unit
  if (event.ctrlKey || event.metaKey) {
    // Pinching a trackpad also arrives here, with small deltas.
    event.preventDefault()
    stopAnimation()
    const factor = 2 ** (-Math.max(-100, Math.min(100, dy)) / 240)
    zoomAround(viewport.value.zoom * factor, local(event.clientX, event.clientY))
    return
  }
  if (!props.panOnScroll || scrollsInside(target, dx, dy)) return
  event.preventDefault()
  stopAnimation()
  if (event.shiftKey && !dx) {
    dx = dy
    dy = 0
  }
  const { x, y, zoom } = viewport.value
  setViewport({ x: x - dx, y: y - dy, zoom })
}

/** Whether something scrollable inside a node can take the scroll itself. */
function scrollsInside(target: Element, dx: number, dy: number) {
  let el: Element | null = target
  while (el && el !== root.value && !(el as HTMLElement).dataset?.nodeId) {
    const style = getComputedStyle(el)
    if (dy && /auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
      if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight) return true
    }
    if (dx && /auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth) {
      if (dx < 0 ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth) return true
    }
    el = el.parentElement
  }
  return false
}

function onDblclick(event: MouseEvent) {
  const nodeEl = (event.target as Element).closest<HTMLElement>('[data-node-id]')
  const node = nodeEl && nodeById.value.get(nodeEl.dataset.nodeId!)
  if (node) emit('node-dblclick', node, event)
}

function onContextmenu(event: MouseEvent) {
  const target = event.target as Element
  if (inPanels(target)) return
  const nodeEl = target.closest<HTMLElement>('[data-node-id]')
  const edgeEl = target.closest<Element>('[data-edge-id]')
  if (nodeEl) {
    const node = nodeById.value.get(nodeEl.dataset.nodeId!)
    if (node) emit('node-contextmenu', node, event)
  } else if (edgeEl) {
    const edge = doc.value.edges.find((e) => e.id === edgeEl.getAttribute('data-edge-id'))
    if (edge) emit('edge-contextmenu', edge, event)
  } else {
    emit('canvas-contextmenu', toCanvas({ x: event.clientX, y: event.clientY }), event)
  }
}

// Keyboard ------------------------------------------------------------------------

const isEditable = (el: Element) =>
  !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')

/** Nodes in reading order: top to bottom, then left to right. */
const readingOrder = () =>
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy
  doc.value.nodes.slice().sort((a, b) => a.y - b.y || a.x - b.x)

function focusNode(id: string) {
  const el = root.value?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)
  el?.focus({ preventScroll: true })
  setSelection({ nodes: [id], edges: [] })
  reveal(id)
}

function deleteSelection() {
  const { nodes, edges } = selection.value
  let count = 0
  transact((tr) => {
    for (const id of edges) {
      if (tr.getEdge(id)) {
        tr.removeEdge(id)
        count++
      }
    }
    for (const id of nodes) {
      const node = tr.getNode(id)
      if (node && !node.locked) {
        tr.removeNode(id)
        count++
      }
    }
  })
  if (count) {
    root.value?.focus({ preventScroll: true })
    announce(format(messages.value.deleted, { count }))
  }
}

function nudge(dx: number, dy: number) {
  const ids = selection.value.nodes
  transact(
    (tr) => {
      for (const id of ids) {
        const node = tr.getNode(id)
        if (node && !node.locked) tr.moveNode(id, node.x + dx, node.y + dy)
      }
    },
    { group: 'nudge' },
  )
  if (ids.length === 1) reveal(ids[0]!)
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as Element
  if (isEditable(target) || inPanels(target)) return
  // Keys typed into a node's own controls are theirs, Escape for their popups included.
  const nodeEl = target.closest('[data-node-id]')
  if (nodeEl && nodeEl !== target) return
  if (keyLink.value) return onKeyLink(event)
  const mod = event.metaKey || event.ctrlKey
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const onCanvas = target === root.value || !!(target as HTMLElement).dataset?.nodeId

  if (mod) {
    let handled = true
    if (key === 'z' && !props.readonly) {
      if (event.shiftKey) redo()
      else undo()
    } else if (key === 'y' && !props.readonly) redo()
    else if (key === 'a') setSelection({ nodes: doc.value.nodes.map((n) => n.id), edges: [] })
    else if (key === 'c' || key === 'x') {
      const data = copySelection()
      if (!data) return
      writeClipboard(data)
      pastes = 0
      if (key === 'x' && !props.readonly) deleteSelection()
    } else if (key === 'v' && !props.readonly) {
      const data = readClipboard()
      if (!data) return
      paste(data, hover ? toCanvas(hover) : null)
    } else if (key === 'd' && !props.readonly) {
      const data = copySelection()
      if (!data) return
      pastes = 0
      paste(data)
    } else if (key === '=' || key === '+') zoomIn()
    else if (key === '-') zoomOut()
    else if (key === '0') zoomTo(1)
    else handled = false
    if (handled) event.preventDefault()
    return
  }
  if (event.altKey) return

  switch (key) {
    case 'Tab': {
      if (!onCanvas) return
      const order = readingOrder()
      if (!order.length) return
      const current = (target as HTMLElement).dataset?.nodeId
      const index = current ? order.findIndex((n) => n.id === current) : -1
      if (event.shiftKey) {
        if (index > 0) focusNode(order[index - 1]!.id)
        else if (index === 0) root.value!.focus({ preventScroll: true })
        else return
      } else if (index < order.length - 1) focusNode(order[index + 1]!.id)
      else {
        // Past the last node: leave the canvas the usual way.
        end.value?.focus({ preventScroll: true })
        return
      }
      event.preventDefault()
      return
    }
    case 'Escape':
      if (cancelDrag()) break
      if (!selection.value.nodes.length && !selection.value.edges.length) return
      setSelection(emptySelection())
      break
    case 'Delete':
    case 'Backspace':
      if (props.readonly) return
      deleteSelection()
      break
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowDown': {
      const sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1
      const horizontal = key === 'ArrowLeft' || key === 'ArrowRight'
      if (selection.value.nodes.length && !props.readonly) {
        const step = (props.grid || 1) * (event.shiftKey ? 4 : 1)
        nudge(horizontal ? sign * step : 0, horizontal ? 0 : sign * step)
      } else {
        const step = event.shiftKey ? 160 : 40
        const { x, y, zoom } = viewport.value
        setViewport(
          { x: horizontal ? x - sign * step : x, y: horizontal ? y : y - sign * step, zoom },
          true,
        )
      }
      break
    }
    case ' ':
      if (!onCanvas) return
      spaceHeld.value = true
      break
    case 'c':
      if (props.readonly || selection.value.nodes.length !== 1) return
      startKeyLink(selection.value.nodes[0]!)
      break
    default:
      return
  }
  event.preventDefault()
}

function onKeyup(event: KeyboardEvent) {
  if (event.key === ' ') spaceHeld.value = false
}

const end = useTemplateRef<HTMLElement>('end')

// Announcements for screen readers.
const live = ref('')
function announce(text: string) {
  live.value = ''
  void nextTick(() => (live.value = text))
}

// Lifecycle --------------------------------------------------------------------------

// Popups opened from inside nodes follow them: they reposition on scroll.
watch(viewport, () => root.value?.dispatchEvent(new Event('scroll')))

onMounted(() => {
  root.value!.addEventListener('wheel', onWheel, { passive: false })
})
onBeforeUnmount(() => {
  root.value?.removeEventListener('wheel', onWheel)
  stopAnimation()
  endGesture()
})

// Selection box and guides, drawn in screen space so they stay 1px.
const marquee = computed<CSSProperties | null>(() => {
  const g = gesture.value
  if (g?.kind !== 'box') return null
  const { x, y, zoom } = viewport.value
  const box = rectFrom(g.start, g.current)
  return {
    transform: `translate(${box.x * zoom + x}px, ${box.y * zoom + y}px)`,
    width: `${box.width * zoom}px`,
    height: `${box.height * zoom}px`,
  }
})

const dragging = computed(() => {
  const g = gesture.value
  return g?.kind === 'drag' && g.started ? new Set(g.origins.keys()) : null
})

const classes = computed(() => ({
  'is-readonly': props.readonly,
  'is-panning': panning.value,
  'is-space': spaceHeld.value,
  'is-dragging': !!dragging.value,
  'is-connecting': !!connecting.value,
}))

provide(flowEditorKey, {
  doc,
  selection,
  viewport,
  readonly: computed(() => props.readonly),
  messages,
  minZoom: computed(() => props.minZoom),
  maxZoom: computed(() => props.maxZoom),
  transact,
  undo,
  redo,
  canUndo,
  canRedo,
  fit,
  zoomTo,
  zoomIn,
  zoomOut,
  portTypeOf,
  colorOf,
})

const selectedNodes = computed(() => new Set(selection.value.nodes))

function updateData(id: string, patch: Record<string, unknown>) {
  transact((tr) => tr.updateData(id, patch), { group: `data:${id}` })
}

defineExpose<FlowEditorExpose>({
  transact,
  undo,
  redo,
  get canUndo() {
    return canUndo.value
  },
  get canRedo() {
    return canRedo.value
  },
  fit,
  zoomTo,
  zoomIn,
  zoomOut,
  centerNode,
  toCanvas,
  getNodeRect,
})
</script>

<template>
  <div
    ref="root"
    class="dou-flow-editor"
    :class="classes"
    :style="background"
    role="application"
    :aria-label="label"
    :aria-description="messages.canvas"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="hover = null"
    @dblclick="onDblclick"
    @contextmenu="onContextmenu"
    @keydown="onKeydown"
    @keyup="onKeyup"
    @blur.capture="spaceHeld = false"
  >
    <div class="dou-flow-editor__layer" :style="layerStyle">
      <svg class="dou-flow-editor__edges" aria-hidden="true">
        <g v-for="item in edgePaths" :key="item.edge.id" :data-edge-id="item.edge.id">
          <path class="dou-flow-editor__edge-hit" :d="item.path" />
          <path
            class="dou-flow-editor__edge"
            :style="item.style"
            :class="{ 'is-selected': item.selected }"
            :d="item.path"
          />
        </g>
        <path v-if="previewPath" class="dou-flow-editor__edge is-preview" :d="previewPath" />
      </svg>
      <NodeView
        v-for="node in doc.nodes"
        :key="node.id"
        :node="node"
        :spec="specOf(node)"
        :selected="selectedNodes.has(node.id)"
        :readonly="readonly"
        :dragging="!!dragging?.has(node.id)"
        :connected="connected.get(node.id) ?? none"
        :port-states="portStates ? (portStates.get(node.id) ?? noStates) : null"
        :role-description="messages.node"
        :description="describe(node)"
        @measure="onMeasure"
        @update="updateData"
      />
      <svg v-if="guides.length" class="dou-flow-editor__guides" aria-hidden="true">
        <line
          v-for="(guide, i) in guides"
          :key="i"
          :x1="guide.axis === 'x' ? guide.at : guide.from"
          :y1="guide.axis === 'x' ? guide.from : guide.at"
          :x2="guide.axis === 'x' ? guide.at : guide.to"
          :y2="guide.axis === 'x' ? guide.to : guide.at"
        />
      </svg>
    </div>
    <div v-if="marquee" class="dou-flow-editor__marquee" :style="marquee" />
    <div class="dou-flow-editor__panels">
      <slot />
    </div>
    <span ref="end" class="dou-flow-editor__end" tabindex="-1" />
    <div class="dou-flow-editor__live" aria-live="polite">{{ live }}</div>
  </div>
</template>
