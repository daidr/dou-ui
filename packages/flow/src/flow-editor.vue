<script setup lang="ts">
import { layoutGraph, matchesHotkey, useReducedMotion, type Tone } from 'dou-ui'
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
import FlowMenu from './components/flow-menu.vue'
import FlowQuickAdd from './components/flow-quick-add.vue'
import FlowToolbar from './components/flow-toolbar.vue'
import { defaultNode } from './components/default-node'
import {
  flowEditorKey,
  type FlowEditorContext,
  type FlowEditorEmits,
  type FlowEditorExpose,
  type FlowEditorProps,
  type FlowEditorSlots,
  type FlowInsertOptions,
  type NodeMetrics,
  type PortAnchor,
  type PortState,
} from './context'
import { bezierEdge, type EdgeAnchor, type EdgeRoute, type EdgeTypeSpec } from './core/edge-types'
import { boundsOf, intersects, rectFrom, snapBox, type Guide, type SnapLink } from './core/geometry'
import {
  canJoin,
  displacedEdges,
  joinRefusal,
  primaryType,
  typesMatch,
  type FlowConnection,
  type JoinRefusal,
  type PortTypeSpec,
} from './core/connect'
import { FlowHistory } from './core/history'
import { flowOrder } from './core/order'
import { resolveFlowExtensions } from './core/extension'
import { flowKit } from './kit'
import type { FlowMenuItem, FlowMenuTarget, FlowToolbarItem } from './core/menu'
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
import { containerAt, FlowTree } from './core/groups'
import { labelOf, portsOf, type NodeTypeSpec } from './core/node-types'
import { FlowTransaction, type FlowTransactionMeta } from './core/transaction'
import { format, useFlowMessages } from './locale'

defineOptions({ name: 'DouFlowEditor' })

const props = withDefaults(defineProps<FlowEditorProps>(), {
  grid: 8,
  guides: true,
  minZoom: 0.1,
  maxZoom: 4,
  fitView: false,
  direction: 'horizontal',
  fitMinZoom: 0.5,
  readonly: false,
  panOnScroll: true,
  edgeType: 'bezier',
  simpleZoom: 0.4,
})
const doc = defineModel<FlowDocument>({ default: emptyDocument })
const selection = defineModel<FlowSelection>('selection', { default: emptySelection })
const viewport = defineModel<FlowViewport>('viewport', {
  default: () => ({ x: 0, y: 0, zoom: 1 }),
})
const emit = defineEmits<FlowEditorEmits>()
defineSlots<FlowEditorSlots>()

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

const resolved = computed(() => resolveFlowExtensions(props.extensions ?? flowKit()))

// Types given as props add to the extensions' and win over them.
const types = computed(() => {
  const map = new Map(resolved.value.nodeTypes)
  for (const spec of props.nodeTypes ?? []) map.set(spec.type, spec as NodeTypeSpec)
  return map
})
const portTypes = computed(() => ({ ...resolved.value.portTypes, ...props.portTypes }))
const edgeTypes = computed(() => {
  const map = new Map(resolved.value.edgeTypes)
  for (const spec of props.edgeTypes ?? []) map.set(spec.type, spec as EdgeTypeSpec)
  return map
})
const edgeTypeOf = (type?: string) =>
  edgeTypes.value.get(type ?? props.edgeType) ?? edgeTypes.value.get(props.edgeType) ?? bezierEdge
const specOf = (node: FlowNode) =>
  types.value.get(node.type ?? 'default') ??
  types.value.get('default') ??
  (defaultNode as NodeTypeSpec)

/** Each node's ports by id, worked out once per change rather than per edge. */
const portsByNode = computed(() => {
  const map = new Map<string, Map<string, FlowPortSpec>>()
  for (const node of nodeById.value.values())
    map.set(node.id, new Map(portsOf(specOf(node), node).map((port) => [port.id, port])))
  return map
})

function portSpec(end: FlowEndpoint) {
  if (end.port == null) return undefined
  return portsByNode.value.get(end.node)?.get(end.port)
}

const portTypeOf = (port: FlowPortSpec): PortTypeSpec | undefined => {
  const type = primaryType(port)
  return type ? portTypes.value[type] : undefined
}

const tones = new Set<string>([
  'neutral',
  'primary',
  'success',
  'warning',
  'danger',
] satisfies Tone[])
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

function commit(tr: FlowTransaction) {
  doc.value = tr.doc
  const removes = tr.steps.some((s) => s.type === 'removeNode' || s.type === 'removeEdge')
  if (removes) setSelection(pruneSelection(tr.doc))
  emit('transaction', tr)
}

function transact(fn: (tr: FlowTransaction) => void, meta?: FlowTransactionMeta) {
  const tr = new FlowTransaction(toRaw(doc.value))
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
/** Where nodes are drawn while tidying animates them; their real place is already in `doc`. */
const tween = shallowRef<Map<string, Point> | null>(null)
const shownNodes = computed(() => {
  const moving = tween.value
  if (!moving) return doc.value.nodes
  return doc.value.nodes.map((node) => {
    const at = moving.get(node.id)
    return at ? { ...node, x: at.x, y: at.y } : node
  })
})
const nodeById = computed(() => new Map(shownNodes.value.map((node) => [node.id, node])))

// Containers ----------------------------------------------------------------------

const tree = computed(() => new FlowTree(doc.value.nodes))
const isContainer = (node: FlowNode) => !!specOf(node).container

/** For each node inside a collapsed container: the outermost collapsed one, where its edges end. */
const hiddenIn = computed(() => {
  const map = new Map<string, string>()
  for (const node of doc.value.nodes) {
    if (!node.data?.collapsed || !isContainer(node)) continue
    for (const id of tree.value.descendants(node.id)) {
      let outer: string | undefined
      for (const a of tree.value.ancestors(id))
        if (nodeById.value.get(a)?.data?.collapsed) outer = a
      if (outer) map.set(id, outer)
    }
  }
  return map
})

// Nodes folded away can't stay selected.
watch(hiddenIn, (hidden) => {
  const { nodes, edges } = selection.value
  if (nodes.some((id) => hidden.has(id)))
    setSelection({ nodes: nodes.filter((id) => !hidden.has(id)), edges })
})

/** Containers with a size, innermost last; `skip` leaves some out, e.g. those being dragged. */
function containerRects(skip?: Set<string>) {
  return doc.value.nodes.flatMap((node) =>
    isContainer(node) && !hiddenIn.value.has(node.id) && !skip?.has(node.id) && metrics.has(node.id)
      ? [{ id: node.id, rect: rectOf(node) }]
      : [],
  )
}

/** Two measurements of a node that place it and its ports the same. */
function sameMetrics(a: NodeMetrics | undefined, b: NodeMetrics) {
  if (!a || a.width !== b.width || a.height !== b.height || a.ports.size !== b.ports.size)
    return false
  for (const [id, p] of b.ports) {
    const q = a.ports.get(id)
    if (!q || q.x !== p.x || q.y !== p.y || q.side !== p.side) return false
  }
  return true
}

function onMeasure(id: string, value: NodeMetrics) {
  // A node drawn again after scrolling back into view measures the same.
  if (!sameMetrics(metrics.get(id), value)) metrics.set(id, value)
  const wait = pending.get(id)
  if (!wait) return
  pending.delete(id)
  // Now that the node has a size: its centre, or the port taking the edge, goes on the point.
  const port = wait.port ? value.ports.get(wait.port) : undefined
  const vertical = props.direction === 'vertical'
  // `start`: the point is where the node begins along the flow, centred across it.
  const along = (v: number, size: number, flow: boolean) => (wait.start && flow ? v : v - size / 2)
  let x = snapTo(port ? wait.at.x - port.x : along(wait.at.x, value.width, !vertical))
  let y = snapTo(port ? wait.at.y - port.y : along(wait.at.y, value.height, vertical))
  if (wait.avoid) {
    // Step across the flow until the node covers no other.
    const others = doc.value.nodes.flatMap((n) => (n.id === id ? [] : (getNodeRect(n.id) ?? [])))
    const step = snapTo((vertical ? value.width : value.height) + 16)
    const free = (px: number, py: number) =>
      !others.some((r) =>
        intersects({ x: px - 8, y: py - 8, width: value.width + 16, height: value.height + 16 }, r),
      )
    for (let i = 0; i < 40 && !free(x, y); i++) {
      if (vertical) x += step
      else y += step
    }
  }
  const node = doc.value.nodes.find((n) => n.id === id)
  if (node && (node.x !== x || node.y !== y))
    transact((tr) => tr.moveNode(id, x, y), { group: wait.group })
  void nextTick(() => {
    // A node added near the edge is scrolled into view, and takes focus so keys act on it.
    reveal(id)
    if (wait.focus)
      root.value
        ?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)
        ?.focus({ preventScroll: true })
  })
}

/** Nodes just added, waiting for their size to be placed: the point and the port to put on it. */
const pending = new Map<
  string,
  { at: Point; port?: string; group: string; start?: boolean; avoid?: boolean; focus?: boolean }
>()
const snapTo = (v: number) => (props.grid ? Math.round(v / props.grid) * props.grid : Math.round(v))

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

/** Where an edge ends: on the collapsed container hiding its node, if any. */
function edgeEnd(end: FlowEdge['source']): FlowEdge['source'] {
  const outer = hiddenIn.value.get(end.node)
  return outer ? { node: outer } : end
}

/**
 * Edges whose ports no longer fit: a port is gone, or its type changed so
 * the two ends don't match any more, e.g. after a form in a node changed it.
 */
const staleEdges = computed(() => {
  const out = new Set<string>()
  for (const edge of doc.value.edges) {
    const { source, target } = edge
    if (source.port == null && target.port == null) continue
    const a = source.port == null ? undefined : portSpec(source)
    const b = target.port == null ? undefined : portSpec(target)
    if ((source.port != null && !a) || (target.port != null && !b)) out.add(edge.id)
    else if (
      a &&
      b &&
      (a.kind !== 'output' || b.kind !== 'input' || !typesMatch(a, b, portTypes.value))
    )
      out.add(edge.id)
  }
  return out
})

// Say so when a change leaves edges that don't fit.
watch(staleEdges, (now, before) => {
  let added = 0
  for (const id of now) if (!before.has(id)) added++
  if (added) announce(format(messages.value.stale, { count: added }))
})

function removeStaleEdges() {
  const ids = [...staleEdges.value]
  if (ids.length) transact((tr) => ids.forEach((id) => tr.removeEdge(id)))
  return ids.length
}

/** How far an edge may bulge past its ends, in canvas px. */
const EDGE_REACH = 80

/** Every edge's route and the box around it; independent of the view, so panning skips it. */
const edgeRoutes = computed(() => {
  const out: { edge: FlowEdge; route: EdgeRoute; box: Rect; style?: CSSProperties }[] = []
  // Read once: adding or removing edges is tracked, single edges are replaced whole.
  const edges = doc.value.edges
  void edges.length
  for (const edge of toRaw(edges)) {
    const from = edgeEnd(edge.source)
    const to = edgeEnd(edge.target)
    // Both ends folded into the same container.
    if (from.node === to.node && (from !== edge.source || to !== edge.target)) continue
    const source = nodeById.value.get(from.node)
    const target = nodeById.value.get(to.node)
    if (!source || !target) continue
    const a = anchor(source, from.port, 'source')
    const b = anchor(target, to.port, 'target')
    if (!a || !b) continue
    out.push({
      edge,
      route: edgeTypeOf(edge.type).route(a, b, edge),
      // Both ends, with room for the curve.
      box: {
        x: Math.min(a.x, b.x) - EDGE_REACH,
        y: Math.min(a.y, b.y) - EDGE_REACH,
        width: Math.abs(a.x - b.x) + EDGE_REACH * 2,
        height: Math.abs(a.y - b.y) + EDGE_REACH * 2,
      },
      style: edgeStyle(edge),
    })
  }
  return out
})

/** The edges in view. */
const edgePaths = computed(() => {
  const selected = new Set(selection.value.edges)
  const moving = connecting.value?.edge
  const area = drawnArea.value
  const stale = staleEdges.value
  const out: {
    edge: FlowEdge
    route: EdgeRoute
    selected: boolean
    stale: boolean
    style?: CSSProperties
  }[] = []
  for (const item of edgeRoutes.value) {
    const { edge } = item
    if (edge.id === moving || (area && !intersects(item.box, area))) continue
    out.push({
      edge,
      route: item.route,
      selected: selected.has(edge.id),
      stale: stale.has(edge.id),
      style: item.style,
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

/** The handle that reshapes the one selected edge, e.g. a step edge's middle. */
const bend = computed(() => {
  const { nodes, edges } = selection.value
  if (props.readonly || nodes.length || edges.length !== 1) return null
  const item = edgeRoutes.value.find((e) => e.edge.id === edges[0])
  const handle = item?.route.handle
  return handle && item ? { edge: item.edge, handle } : null
})

// Edges from the keyboard ----------------------------------------------------------

/** The node whose edges `E` goes through, and the one last selected. */
let edgeCycle: { node: string; edge: string } | null = null

/**
 * Selects the next edge of the selected node, or of the node whose edges
 * are being gone through, and says which nodes it joins.
 */
function cycleEdges(step: 1 | -1) {
  const { nodes, edges } = selection.value
  let node: string | undefined
  let current: string | undefined
  if (nodes.length === 1 && !edges.length) node = nodes[0]
  else {
    const last = edgeCycle
    if (last && !nodes.length && edges.length === 1 && last.edge === edges[0]) {
      node = last.node
      current = last.edge
    }
  }
  if (!node) return false
  // Outgoing first, each in document order.
  const all = doc.value.edges
  const list = [
    ...all.filter((e) => e.source.node === node),
    ...all.filter((e) => e.target.node === node && e.source.node !== node),
  ]
  if (!list.length) {
    announce(messages.value.noEdges)
    return true
  }
  const index = current ? list.findIndex((e) => e.id === current) : -1
  const edge = list[(index + step + list.length) % list.length]!
  edgeCycle = { node, edge: edge.id }
  setSelection({ nodes: [], edges: [edge.id] })
  announce(describeEdge(edge))
  return true
}

function nodeName(id: string) {
  const node = nodeById.value.get(id)
  return node ? labelOf(specOf(node), node) : id
}

function describeEdge(edge: FlowEdge) {
  const t = messages.value
  const text = format(t.edge, { from: nodeName(edge.source.node), to: nodeName(edge.target.node) })
  return edge.label ? text + format(t.edgeLabel, { label: edge.label }) : text
}

// Edge labels ----------------------------------------------------------------------

const editingLabel = ref<string | null>(null)
const labelDraft = ref('')

// Too small to read when zoomed out, except the one being typed.
const edgeLabels = computed(() =>
  edgePaths.value.filter(
    (item) => item.edge.id === editingLabel.value || (item.edge.label && !simple.value),
  ),
)

/** Opens the text field on an edge's label. */
function editLabel(id: string) {
  if (props.readonly || !doc.value.edges.some((e) => e.id === id)) return
  setSelection({ nodes: [], edges: [id] })
  labelDraft.value = doc.value.edges.find((e) => e.id === id)!.label ?? ''
  editingLabel.value = id
  void nextTick(() => {
    const input = root.value?.querySelector<HTMLInputElement>('.dou-flow-editor__label-input')
    input?.focus({ preventScroll: true })
    input?.select()
  })
}

function finishLabel(save: boolean) {
  const id = editingLabel.value
  if (!id) return
  editingLabel.value = null
  const text = labelDraft.value.trim()
  if (save && transact((tr) => tr.updateEdge(id, { label: text || undefined })).changed)
    announce(messages.value.labelSaved)
  root.value?.focus({ preventScroll: true })
}

function onLabelKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') finishLabel(true)
  else if (event.key === 'Escape') finishLabel(false)
  else return
  event.preventDefault()
  event.stopPropagation()
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

/** How many edges touch each node. */
const degree = computed(() => {
  const map = new Map<string, number>()
  const add = (id: string) => map.set(id, (map.get(id) ?? 0) + 1)
  for (const edge of toRaw(doc.value).edges) {
    add(edge.source.node)
    if (edge.target.node !== edge.source.node) add(edge.target.node)
  }
  return map
})

function describe(node: FlowNode) {
  const ports = portsOf(specOf(node), node)
  if (!ports.length) return ''
  return format(messages.value.ports, {
    inputs: ports.filter((p) => p.kind === 'input').length,
    outputs: ports.filter((p) => p.kind === 'output').length,
    connected: degree.value.get(node.id) ?? 0,
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

/**
 * Shows the given nodes, or all. With `floor`, zooms out no further than
 * that; what still doesn't fit starts at the top left, to be panned to.
 */
function fit(ids?: string[], animate = true, floor = 0) {
  const nodes = ids ? ids.map((id) => nodeById.value.get(id)!).filter(Boolean) : doc.value.nodes
  const bounds = boundsOf(nodes.map(rectOf))
  if (bounds) fitRect(bounds, animate, floor)
}

/**
 * Room to leave around the nodes: the padding, or more where a panel
 * (controls, minimap…) sits in a corner, so fitted nodes don't end
 * up under it. Each panel takes room on the side where it costs less: a
 * wide one above or below, a tall one on the left or right.
 */
function fitInsets() {
  const box = root.value!.getBoundingClientRect()
  const insets = { top: FIT_PADDING, bottom: FIT_PADDING, left: FIT_PADDING, right: FIT_PADDING }
  for (const panel of root.value!.querySelectorAll(
    '.dou-flow-editor__panels > :not(.dou-flow-toolbar)',
  )) {
    const rect = panel.getBoundingClientRect()
    if (!rect.height) continue
    const upper = rect.top + rect.height / 2 < box.top + box.height / 2
    const leftward = rect.left + rect.width / 2 < box.left + box.width / 2
    const vertical = upper ? rect.bottom - box.top : box.bottom - rect.top
    const horizontal = leftward ? rect.right - box.left : box.right - rect.left
    if (vertical / box.height <= horizontal / box.width) {
      const side = upper ? 'top' : 'bottom'
      insets[side] = Math.max(insets[side], vertical + PANEL_GAP)
    } else {
      const side = leftward ? 'left' : 'right'
      insets[side] = Math.max(insets[side], horizontal + PANEL_GAP)
    }
  }
  return insets
}

/** Room between a panel and the nodes fitted next to it. */
const PANEL_GAP = 16

function fitRect(bounds: Rect, animate: boolean, floor: number) {
  if (!root.value) return
  const width = root.value.clientWidth
  const height = root.value.clientHeight
  const insets = fitInsets()
  const zoom = clampZoom(
    Math.max(
      Math.min(
        (width - insets.left - insets.right) / Math.max(1, bounds.width),
        (height - insets.top - insets.bottom) / Math.max(1, bounds.height),
        1,
      ),
      Math.min(floor, 1),
    ),
  )
  // Centres the nodes in the room between `before` and `after`, or starts them at `before` when they don't fit.
  const offset = (room: number, size: number, start: number, before: number, after: number) =>
    Math.round(
      size * zoom > room - before - after
        ? before - start * zoom
        : before + (room - before - after - size * zoom) / 2 - start * zoom,
    )
  setViewport(
    {
      x: offset(width, bounds.width, bounds.x, insets.left, insets.right),
      y: offset(height, bounds.height, bounds.y, insets.top, insets.bottom),
      zoom,
    },
    animate,
  )
}

/** Room between ranks (along the flow) and between nodes in a rank when tidying. */
const TIDY_GAP = { horizontal: { rank: 80, row: 40 }, vertical: { rank: 56, row: 40 } }

/**
 * Lays the given nodes, or the selected ones when two or more are selected,
 * or all, out in ranks along their edges in the flow's `direction`, as one
 * undo step. The group keeps its top left corner; locked nodes stay put.
 */
function tidy(ids?: string[]) {
  const chosen = new Set(
    ids ??
      (selection.value.nodes.length > 1 ? selection.value.nodes : doc.value.nodes.map((n) => n.id)),
  )
  // Nodes all in one container are laid out inside it; otherwise on the canvas.
  const parents = new Set(tree.value.topmost(chosen).map((id) => tree.value.parentOf(id)))
  const scope = parents.size === 1 ? [...parents][0] : undefined
  // A container is laid out as one block with what is inside it; edges to its nodes count as its own.
  const blockOf = (id: string) => {
    let at: string | undefined = id
    while (at && tree.value.parentOf(at) !== scope) at = tree.value.parentOf(at)
    return at
  }
  const blocks = new Set([...chosen].flatMap((id) => blockOf(id) ?? []))
  const nodes = doc.value.nodes.filter((node) => blocks.has(node.id))
  const bounds = boundsOf(nodes.map(rectOf))
  if (!bounds || nodes.length < 2) return
  // A vertical flow is laid out as a horizontal one with x and y swapped.
  const vertical = props.direction === 'vertical'
  const gap = TIDY_GAP[vertical ? 'vertical' : 'horizontal']
  const across = vertical ? (['top', 'bottom'] as const) : (['left', 'right'] as const)
  const layout = layoutGraph(
    nodes.map((node) => {
      const m = metrics.get(node.id)
      const rect = rectOf(node)
      const width = vertical ? rect.height : rect.width
      const height = vertical ? rect.width : rect.height
      // Ranks line up on the first port facing along the flow, so edges between levelled ports run straight.
      let offset = height / 2
      for (const port of m?.ports.values() ?? [])
        if ((across as readonly string[]).includes(port.side)) {
          offset = vertical ? port.x : port.y
          break
        }
      return { id: node.id, width, height, anchor: offset }
    }),
    doc.value.edges.flatMap((e) => {
      const from = blockOf(e.source.node)
      const to = blockOf(e.target.node)
      return from && to && from !== to && blocks.has(from) && blocks.has(to) ? [{ from, to }] : []
    }),
    { columnGap: gap.rank, rowGap: gap.row, equalWidth: false, grid: props.grid || 8 },
  )
  const snap = (v: number) => (props.grid ? Math.round(v / props.grid) * props.grid : Math.round(v))
  const origin = { x: snap(bounds.x), y: snap(bounds.y) }
  const from = new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]))
  const moved = new Map<string, Point>()
  for (const node of nodes) {
    const placed = layout.nodes.get(node.id)
    if (!placed || node.locked) continue
    const x = vertical ? placed.y : placed.x
    const y = vertical ? placed.x : placed.y
    const to = { x: origin.x + snap(x), y: origin.y + snap(y) }
    if (to.x !== node.x || to.y !== node.y) moved.set(node.id, to)
  }
  if (!moved.size) return
  const count = moved.size
  // What is inside a moved container moves the same way.
  for (const { id } of nodes) {
    const to = moved.get(id)
    if (!to) continue
    const block = from.get(id)!
    for (const inner of tree.value.descendants(id)) {
      const node = nodeById.value.get(inner)
      if (!node) continue
      from.set(inner, { x: node.x, y: node.y })
      moved.set(inner, { x: node.x + to.x - block.x, y: node.y + to.y - block.y })
    }
  }
  transact((tr) => {
    for (const [id, to] of moved) tr.moveNode(id, to.x, to.y)
  })
  announce(format(messages.value.tidied, { count }))
  animateTidy(from, moved)
  // A tidier layout can be wider or taller; bring it back into view if so.
  const after = boundsOf(
    nodes.map((node) => ({ ...rectOf(node), ...(moved.get(node.id) ?? from.get(node.id)) })),
  )!
  const { x, y, zoom } = viewport.value
  const { width, height } = size.value
  const inView =
    after.x * zoom + x >= 0 &&
    after.y * zoom + y >= 0 &&
    (after.x + after.width) * zoom + x <= width &&
    (after.y + after.height) * zoom + y <= height
  if (!inView) fitRect(after, true, props.fitMinZoom)
}

let tweenFrame = 0
const easeOut = (t: number) => 1 - (1 - t) ** 3

/** Glides moved nodes from where they were to where tidying put them. */
function animateTidy(from: Map<string, Point>, to: Map<string, Point>) {
  cancelAnimationFrame(tweenFrame)
  if (reducedMotion.value || typeof requestAnimationFrame === 'undefined') return
  const start = performance.now()
  const duration = 220
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    const k = easeOut(t)
    const frame = new Map<string, Point>()
    for (const [id, end] of to) {
      const a = from.get(id)!
      frame.set(id, { x: a.x + (end.x - a.x) * k, y: a.y + (end.y - a.y) * k })
    }
    tween.value = t < 1 ? frame : null
    if (t < 1) tweenFrame = requestAnimationFrame(step)
  }
  tween.value = new Map(from)
  tweenFrame = requestAnimationFrame(step)
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
    fit(undefined, false, props.fitMinZoom)
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
  return {
    transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    '--dou-flow-editor-zoom': zoom,
  } as CSSProperties
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
      touch: boolean
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
      kind: 'resize'
      id: number
      touch: boolean
      node: string
      start: Point
      origin: { width: number; height: number }
      min: { width: number; height: number }
      group: string
    }
  | {
      kind: 'bend'
      id: number
      touch: boolean
      edge: string
      /** The edge's data before the drag, to put back on Escape. */
      origin: FlowEdge['data']
      move: NonNullable<EdgeRoute['handle']>['move']
      group: string
      start: Point
      /** From the pointer to the handle, in canvas coordinates. */
      offset: Point
      started: boolean
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
  /** A port under the pointer that can't be joined, and why. */
  refused?: { end: Required<FlowEndpoint>; refusal: JoinRefusal } | null
  /** Ports the moving end may land on: port ids by node. */
  valid: Map<string, Set<string>>
}

const gesture = shallowRef<Gesture | null>(null)
const guides = shallowRef<Guide[]>([])
const panning = ref(false)
const spaceHeld = ref(false)
let pressTimer = 0
let dragCount = 0

/** When a finger last went down, to tell a long press's own context menu event. */
let lastTouch = 0
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
    lastTouch = Date.now()
    // The first finger of a new touch: any finger still on record lifted
    // where the editor didn't hear it (outside it, or taken by the browser).
    if (event.isPrimary) {
      touches.clear()
      pinch = null
    }
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
  // Typing a label: the field's own presses.
  if (target.closest('.dou-flow-editor__label-input')) return

  const resizeEl = target.closest('.dou-flow-editor__resize')
  if (resizeEl && nodeEl && !props.readonly) {
    const node = nodeById.value.get(nodeEl.dataset.nodeId!)
    const resizable = node && specOf(node).resizable
    if (node && resizable) {
      const rect = rectOf(node)
      const min = typeof resizable === 'object' ? resizable : {}
      gesture.value = {
        kind: 'resize',
        id: event.pointerId,
        touch,
        node: node.id,
        start: toCanvas(client),
        origin: { width: rect.width, height: rect.height },
        min: { width: min.minWidth ?? 40, height: min.minHeight ?? 40 },
        group: `resize:${++dragCount}`,
      }
      capture(event.pointerId)
      return
    }
  }

  // The handle, or the label sitting on it.
  const bendEl = target.closest('.dou-flow-editor__bend, .dou-flow-editor__label.is-bend')
  if (bendEl && bend.value) {
    const { edge, handle } = bend.value
    const at = toCanvas(client)
    gesture.value = {
      kind: 'bend',
      id: event.pointerId,
      touch,
      edge: edge.id,
      origin: edge.data,
      move: handle.move,
      group: `bend:${++dragCount}`,
      start: client,
      offset: { x: handle.at.x - at.x, y: handle.at.y - at.y },
      started: false,
    }
    // Captured once it moves, so a double click still reaches the label.
    return
  }

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

  // Shift-dragging inside a container selects the nodes in it, as on the canvas.
  const pressed = nodeEl && nodeById.value.get(nodeEl.dataset.nodeId!)
  if (pressed && isContainer(pressed) && event.shiftKey && !touch && !isInteractive(target)) {
    startBox(event, client)
    return
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
    // Captured once it moves, so a double click still reaches the node.
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
    if (edge) emit('edgeClick', edge, event)
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
    touch: event.pointerType === 'touch',
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
  // Both fingers report back here even when they leave the editor.
  for (const id of touches.keys()) capture(id)
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
  } else if (g.kind === 'resize') {
    const p = toCanvas(client)
    const width = snapTo(Math.max(g.min.width, g.origin.width + p.x - g.start.x))
    const height = snapTo(Math.max(g.min.height, g.origin.height + p.y - g.start.y))
    transact((tr) => tr.updateNode(g.node, { width, height }), { group: g.group })
  } else if (g.kind === 'bend') {
    if (!g.started) {
      if (
        Math.hypot(client.x - g.start.x, client.y - g.start.y) <
        THRESHOLD[g.touch ? 'touch' : 'mouse']
      )
        return
      g.started = true
      capture(g.id)
    }
    const p = toCanvas(client)
    const patch = g.move({ x: p.x + g.offset.x, y: p.y + g.offset.y })
    transact((tr) => tr.updateEdge(g.edge, { data: { ...g.origin, ...patch } }), {
      group: g.group,
    })
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
  // A container only when the box takes it in whole, so a box drawn inside picks its nodes.
  const inside = (r: Rect) =>
    r.x >= box.x &&
    r.y >= box.y &&
    r.x + r.width <= box.x + box.width &&
    r.y + r.height <= box.y + box.height
  const hit = doc.value.nodes
    .filter((node) => {
      if (hiddenIn.value.has(node.id)) return false
      const rect = rectOf(node)
      return isContainer(node) ? inside(rect) : intersects(box, rect)
    })
    .map((n) => n.id)
  const nodes = [...new Set([...g.base.nodes, ...hit])]
  setSelection({ nodes, edges: g.base.edges })
  gesture.value = { ...g }
}

/**
 * What moving `ids` moves: the unlocked ones and everything inside them,
 * locked or not, since a container carries its contents.
 */
function carried(ids: readonly string[]) {
  const out = new Set<string>()
  for (const id of ids) {
    if (out.has(id) || nodeById.value.get(id)?.locked) continue
    out.add(id)
    for (const inner of tree.value.descendants(id)) out.add(inner)
  }
  return out
}

function startDrag(g: Extract<Gesture, { kind: 'drag' }>) {
  g.started = true
  capture(g.id)
  g.group = `drag:${++dragCount}`
  const moving = carried(selection.value.nodes)
  for (const node of doc.value.nodes) {
    if (moving.has(node.id)) g.origins.set(node.id, { x: node.x, y: node.y })
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
  dropTarget.value = containerAt(p, containerRects(new Set(g.origins.keys()))) ?? null
}

/** The container the dragged nodes will go into, or `null` for the canvas. */
const dropTarget = ref<string | null>(null)

/** After a drag: the moved nodes go into the container under the pointer, or out of theirs. */
function settleDrop(g: Extract<Gesture, { kind: 'drag' }>) {
  const target = dropTarget.value ?? undefined
  dropTarget.value = null
  const moved = tree.value.topmost(g.origins.keys())
  if (!moved.some((id) => tree.value.parentOf(id) !== target)) return
  transact(
    (tr) => {
      for (const id of moved)
        if (tree.value.parentOf(id) !== target) tr.updateNode(id, { parent: target })
    },
    { group: g.group },
  )
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
    if (
      !g ||
      g.kind === 'pan' ||
      g.kind === 'bend' ||
      g.kind === 'resize' ||
      ((g.kind === 'drag' || g.kind === 'connect') && !g.started)
    )
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

/** The prop's rule, then each extension's, in priority order; the first refusal wins. */
const canConnect = computed(() => {
  const rules = [...(props.canConnect ? [props.canConnect] : []), ...resolved.value.rules]
  if (!rules.length) return undefined
  return (connection: FlowConnection, current: FlowDocument) => {
    for (const rule of rules) {
      const verdict = rule(connection, current)
      if (verdict !== true) return verdict
    }
    return true
  }
})

const connectOptions = () => ({
  portTypes: portTypes.value,
  acyclic: props.acyclic,
  canConnect: canConnect.value,
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
  const candidate = (best as { end: Required<FlowEndpoint> } | null)?.end ?? null
  g.link = { ...link, point, candidate, refused: candidate ? null : refusedAt(link, point, radius) }
  gesture.value = { ...g }
}

/** The nearest port within `radius` of `point` that the link can't land on, and why. */
function refusedAt(link: Link, point: Point, radius: number) {
  const fixedPort = portSpec(link.fixed)
  if (!fixedPort) return null
  let best: { end: Required<FlowEndpoint>; d: number } | null = null
  for (const node of doc.value.nodes)
    for (const port of portsOf(specOf(node), node)) {
      if (link.valid.get(node.id)?.has(port.id)) continue
      const end = { node: node.id, port: port.id }
      if (end.node === link.fixed.node && end.port === link.fixed.port) continue
      const at = anchorOf(end, link.moving)
      const d = at ? Math.hypot(at.x - point.x, at.y - point.y) : Infinity
      if (d <= radius && (!best || d < best.d)) best = { end, d }
    }
  if (!best) return null
  const { end } = best as { end: Required<FlowEndpoint> }
  const port = portSpec(end)!
  const ports =
    link.moving === 'target'
      ? { source: fixedPort, target: port }
      : { source: port, target: fixedPort }
  const refusal = joinRefusal(
    toRaw(doc.value),
    connectionOf(link, end),
    ports,
    connectOptions(),
    link.edge,
  )
  return refusal && { end, refusal }
}

/** What screen readers hear when a link is refused. */
function refusalText(refusal: JoinRefusal) {
  if (refusal.reason === 'custom') return refusal.message ?? messages.value.refused.custom
  return messages.value.refused[refusal.reason]
}

/** Adds the edge a link describes, replacing what it must. */
function finishLink(link: Link, event?: MouseEvent) {
  const { candidate } = link
  if (!candidate) {
    if (link.refused) {
      // Dropped on a port that can't take it: say why, and leave things as they were.
      announce(refusalText(link.refused.refusal))
    } else if (link.edge) {
      // Dropping a picked-up edge on nothing removes it.
      const id = link.edge
      transact((tr) => tr.removeEdge(id))
    } else if (event) {
      emit('connectToCanvas', link.fixed, link.point, event)
      if (!event.defaultPrevented && paletteTypes.value.length) {
        quickAdd.value = {
          link,
          at: link.point,
          client: { x: event.clientX, y: event.clientY },
          types: typesTaking(link.fixed),
          touch: (event as PointerEvent).pointerType === 'touch',
        }
      }
    }
    return
  }
  const connection = connectionOf(link, candidate)
  const source = portSpec(connection.source)
  const target = portSpec(connection.target)
  const edge: FlowEdge = { id: createId('e'), source: connection.source, target: connection.target }
  const displaced =
    source && target
      ? displacedEdges(toRaw(doc.value), connection, { source, target }, link.edge)
      : []
  transact((tr) => {
    if (link.edge) tr.removeEdge(link.edge)
    for (const id of displaced) tr.removeEdge(id)
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
  // The dropped edge stays drawn while a node for its end is chosen.
  const link = connecting.value ?? quickAdd.value?.link
  if (!link) return null
  const fixedRole = link.moving === 'target' ? 'source' : 'target'
  const a = anchorOf(link.fixed, fixedRole)
  if (!a) return null
  const c = link.candidate && anchorOf(link.candidate, link.moving)
  const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' } as const
  const b: EdgeAnchor = c ?? { ...link.point, side: opposite[a.side] }
  const moved = link.edge ? doc.value.edges.find((e) => e.id === link.edge) : undefined
  const route = edgeTypeOf(moved?.type).route
  return (link.moving === 'target' ? route(a, b, moved) : route(b, a, moved)).path
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
  if (link.refused) set(link.refused.end, 'refused')
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
/** `ids` and every node inside the containers among them. */
function withInside(ids: readonly string[]) {
  const out = new Set(ids)
  for (const id of ids) for (const inner of tree.value.descendants(id)) out.add(inner)
  return [...out]
}

function copySelection(): FlowDocument | null {
  const ids = new Set(withInside(selection.value.nodes))
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
  for (const transform of resolved.value.pasteTransforms) data = transform(data, context)
  const bounds = boundsOf(
    data.nodes.map((n) => ({ x: n.x, y: n.y, width: n.width ?? 0, height: n.height ?? 0 })),
  )
  if (!bounds) return
  const step = (props.grid || 8) * 3
  const shift = at
    ? { x: Math.round(at.x - bounds.x), y: Math.round(at.y - bounds.y) }
    : { x: step * ++pastes, y: step * pastes }
  const ids = new Map(data.nodes.map((n) => [n.id, createId()]))
  const containers = containerRects()
  // Shallow copies: documents are never changed in place.
  const nodes = data.nodes.map((n) => {
    const x = n.x + shift.x
    const y = n.y + shift.y
    // Stays in a copied container; otherwise goes into the one it lands in, if any.
    const copied = n.parent ? ids.get(n.parent) : undefined
    const m = metrics.get(n.id)
    const centre = {
      x: x + (m?.width ?? n.width ?? 0) / 2,
      y: y + (m?.height ?? n.height ?? 0) / 2,
    }
    return {
      ...n,
      data: n.data && { ...n.data },
      id: ids.get(n.id)!,
      x,
      y,
      locked: undefined,
      parent: copied ?? containerAt(centre, containers),
    }
  })
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
  const copies = new Set(ids.values())
  setSelection({
    nodes: nodes.filter((n) => !n.parent || !copies.has(n.parent)).map((n) => n.id),
    edges: [],
  })
}

function duplicate() {
  const data = copySelection()
  if (!data || props.readonly) return
  pastes = 0
  paste(data)
}

function selectAll() {
  setSelection({
    nodes: doc.value.nodes.flatMap((n) => (hiddenIn.value.has(n.id) ? [] : [n.id])),
    edges: [],
  })
}

/** Copies the selection to the system clipboard, and keeps it for pasting from the menu. */
function copy() {
  const data = copySelection()
  if (!data) return false
  const text = writeClipboard(data)
  pastes = 0
  void navigator.clipboard?.writeText(text).catch(() => {})
  return true
}

function cut() {
  if (props.readonly || !copy()) return false
  deleteSelection()
  return true
}

/** Pastes from the system clipboard when the page may read it, or what was copied here. */
async function pasteFromClipboard(at?: Point) {
  if (props.readonly) return false
  let text: string | null = null
  try {
    text = (await navigator.clipboard?.readText()) ?? null
  } catch {
    // Reading the clipboard wasn't allowed: fall back to what was copied here.
  }
  const data = readClipboard(text) ?? readClipboard()
  if (!data) return false
  paste(data, at ?? null)
  return true
}

// Adding nodes ---------------------------------------------------------------------

const paletteTypes = computed(() => [...types.value.values()].filter((spec) => spec.palette))

/** A node of a type, not yet in the document. */
function draft(spec: NodeTypeSpec): FlowNode {
  return {
    id: createId(),
    type: spec.type,
    x: 0,
    y: 0,
    ...spec.size,
    data: spec.defaults?.() ?? {},
  }
}

/** The first port of a new node that can take an edge from `from`, if any. */
function takingPort(node: FlowNode, from: Required<FlowEndpoint>) {
  const fromPort = portSpec(from)
  if (!fromPort) return undefined
  const spec = specOf(node)
  const next = { nodes: [...doc.value.nodes, node], edges: doc.value.edges }
  for (const port of portsOf(spec, node)) {
    if (port.kind === fromPort.kind) continue
    const end = { node: node.id, port: port.id }
    const connection: FlowConnection =
      fromPort.kind === 'output' ? { source: from, target: end } : { source: end, target: from }
    const ports =
      fromPort.kind === 'output'
        ? { source: fromPort, target: port }
        : { source: port, target: fromPort }
    if (!joinRefusal(next, connection, ports, connectOptions())) return port
  }
  return undefined
}

/** Palette types a new node of which could take an edge from `from`. */
function typesTaking(from: Required<FlowEndpoint>) {
  return paletteTypes.value.filter((spec) => takingPort(draft(spec), from))
}

function insertNode(type: string, options: FlowInsertOptions = {}) {
  const spec = types.value.get(type)
  if (!spec || props.readonly) return null
  const node = draft(spec)
  let at = options.at
  let from = options.from
  let start = false
  const after = !at && !from ? soleSelected() : undefined
  if (after) {
    // After the one selected node, connected to it when a port can take an edge from it.
    const rect = getNodeRect(after.id)!
    const vertical = props.direction === 'vertical'
    const gap = TIDY_GAP[props.direction].rank
    for (const out of portsOf(specOf(after), after)) {
      const end = { node: after.id, port: out.id }
      if (out.kind === 'output' && takingPort(node, end)) {
        from = end
        break
      }
    }
    const fromAt = from && anchorOf(from, 'source')
    at = vertical
      ? { x: fromAt?.x ?? rect.x + rect.width / 2, y: rect.y + rect.height + gap }
      : { x: rect.x + rect.width + gap, y: fromAt?.y ?? rect.y + rect.height / 2 }
    start = true
  }
  // Without a point: the middle of the view.
  at ??= toCanvas(clientCenter())
  node.x = snapTo(at.x)
  node.y = snapTo(at.y)
  // Dropped inside a container: it goes in.
  const inside = containerAt(at, containerRects())
  if (inside) node.parent = inside
  const port = from ? takingPort(node, from) : undefined
  const group = `insert:${node.id}`
  transact(
    (tr) => {
      tr.addNode(node)
      if (from && port) {
        const end = { node: node.id, port: port.id }
        const fromPort = portSpec(from)!
        tr.addEdge({
          id: createId('e'),
          source: fromPort.kind === 'output' ? from : end,
          target: fromPort.kind === 'output' ? end : from,
        })
      }
    },
    { group },
  )
  pending.set(node.id, {
    at,
    port: port?.id,
    group,
    start,
    avoid: !options.at,
    focus: options.focus ?? true,
  })
  setSelection({ nodes: [node.id], edges: [] })
  announce(format(messages.value.added, { node: labelOf(spec, node) }))
  return node.id
}

/** The node selected on its own, if any. */
function soleSelected() {
  const { nodes, edges } = selection.value
  return nodes.length === 1 && !edges.length ? nodeById.value.get(nodes[0]!) : undefined
}

/** The middle of the editor on screen. */
function clientCenter(): Point {
  const box = root.value!.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

// Menus and the toolbar ----------------------------------------------------------------

const menu = useTemplateRef<InstanceType<typeof FlowMenu>>('menu')
const menuItems = shallowRef<FlowMenuItem[]>([])

/** The extensions' items for a target, a separator between each extension's. */
function itemsFor(target: FlowMenuTarget) {
  const items: FlowMenuItem[] = []
  for (const fn of resolved.value.menus) {
    const list = fn(context, target)
    list.forEach((item, i) =>
      items.push(i === 0 && items.length ? { ...item, divided: true } : item),
    )
  }
  return items
}

const menuOpen = ref(false)
/** The last press while the menu was open, which closed it. */
let menuPress: { target: EventTarget | null; at: number } | null = null
const onMenuPress = (event: PointerEvent) => {
  menuPress = { target: event.target, at: Date.now() }
}
watch(menuOpen, (open) => {
  if (open) document.addEventListener('pointerdown', onMenuPress, true)
  else document.removeEventListener('pointerdown', onMenuPress, true)
})

function openMenu(target: FlowMenuTarget, client: Point, from?: Element) {
  // The press on the button that opened the menu closed it: leave it closed.
  const press = menuPress
  menuPress = null
  if (
    from &&
    press &&
    Date.now() - press.at < 500 &&
    press.target instanceof Node &&
    from.contains(press.target)
  )
    return false
  const items = itemsFor(target)
  if (!items.length) return false
  menuItems.value = items
  menu.value?.open(client.x, client.y)
  return true
}

function runMenuItem(key: unknown) {
  menuItems.value.find((item) => item.key === key)?.run()
}

onBeforeUnmount(() => document.removeEventListener('pointerdown', onMenuPress, true))

const toolbarItems = computed<FlowToolbarItem[][]>(() => {
  if (props.readonly || gesture.value || keyLink.value || quickAdd.value) return []
  const nodes = selection.value.nodes.flatMap((id) => nodeById.value.get(id) ?? [])
  if (!nodes.length) return []
  return resolved.value.toolbars.map((fn) => fn(context, nodes)).filter((list) => list.length)
})

/** Where the toolbar floats: above the selected nodes, in screen px within the editor. */
const toolbarAnchor = computed(() => {
  const bounds = boundsOf(selection.value.nodes.flatMap((id) => getNodeRect(id) ?? []))
  if (!bounds) return null
  const { x, y, zoom } = viewport.value
  return {
    x: (bounds.x + bounds.width / 2) * zoom + x,
    top: bounds.y * zoom + y,
    bottom: (bounds.y + bounds.height) * zoom + y,
  }
})

// Dropping an edge on the canvas offers the node types that can take it.
const quickAdd = shallowRef<{
  link: Link
  at: Point
  client: Point
  types: NodeTypeSpec[]
  touch: boolean
} | null>(null)

function chooseQuickAdd(type: string | null) {
  const pendingAdd = quickAdd.value
  quickAdd.value = null
  if (!pendingAdd) return
  if (type) insertNode(type, { at: pendingAdd.at, from: pendingAdd.link.fixed })
  else root.value?.focus({ preventScroll: true })
}

// Dragging a new node in, from anywhere on the page --------------------------------

const insertDrag = shallowRef<{
  spec: NodeTypeSpec
  id: number
  touch: boolean
  start: Point
  client: Point
  started: boolean
  /** Whether letting go here adds the node. */
  over: boolean
} | null>(null)

/** Whether a point on screen is on the canvas itself, not on a panel over it. */
function onCanvasAt(client: Point) {
  const el = document.elementFromPoint(client.x, client.y)
  return !!root.value && !!el && root.value.contains(el) && !inPanels(el)
}

function startInsertDrag(type: string, event: PointerEvent) {
  const spec = types.value.get(type)
  if (!spec || props.readonly || event.button !== 0 || insertDrag.value) return false
  const client = { x: event.clientX, y: event.clientY }
  insertDrag.value = {
    spec,
    id: event.pointerId,
    touch: event.pointerType === 'touch',
    start: client,
    client,
    started: false,
    over: false,
  }
  // The source may be anywhere, so the pointer is followed on the window.
  window.addEventListener('pointermove', onInsertMove, true)
  window.addEventListener('pointerup', onInsertUp, true)
  window.addEventListener('pointercancel', onInsertUp, true)
  window.addEventListener('keydown', onInsertKey, true)
  return true
}

function onInsertMove(event: PointerEvent) {
  const d = insertDrag.value
  if (!d || d.id !== event.pointerId) return
  const client = { x: event.clientX, y: event.clientY }
  if (
    !d.started &&
    Math.hypot(client.x - d.start.x, client.y - d.start.y) < THRESHOLD[d.touch ? 'touch' : 'mouse']
  )
    return
  insertDrag.value = { ...d, client, started: true, over: onCanvasAt(client) }
}

function onInsertUp(event: PointerEvent) {
  const d = insertDrag.value
  if (!d || d.id !== event.pointerId) return
  stopInsertDrag()
  if (!d.started) return
  swallowClick()
  const client = { x: event.clientX, y: event.clientY }
  if (event.type === 'pointerup' && onCanvasAt(client))
    insertNode(d.spec.type, { at: toCanvas(client) })
}

// Escape puts the node back.
function onInsertKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !insertDrag.value) return
  event.preventDefault()
  event.stopPropagation()
  if (insertDrag.value.started) swallowClick()
  stopInsertDrag()
}

function stopInsertDrag() {
  insertDrag.value = null
  window.removeEventListener('pointermove', onInsertMove, true)
  window.removeEventListener('pointerup', onInsertUp, true)
  window.removeEventListener('pointercancel', onInsertUp, true)
  window.removeEventListener('keydown', onInsertKey, true)
}

const stopEvent = (event: Event) => {
  event.stopPropagation()
  event.preventDefault()
}

/** The click that ends a drag isn't a click on the source: it doesn't add another node. */
function swallowClick() {
  window.addEventListener('click', stopEvent, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', stopEvent, true))
}

onBeforeUnmount(stopInsertDrag)

const ghostStyle = computed(() => {
  const d = insertDrag.value
  return d ? { transform: `translate(${d.client.x}px, ${d.client.y}px)` } : undefined
})

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
      emit('canvasClick', toCanvas({ x: event.clientX, y: event.clientY }), event)
    } else if (g.kind === 'box' && g.touch && g.current === g.start) {
      // Holding the empty canvas and letting go without moving opens its menu.
      endGesture()
      showMenu({ kind: 'canvas', point: g.start }, { x: event.clientX, y: event.clientY }, event)
      return
    } else if (g.kind === 'connect') {
      if (g.started) finishLink(g.link, event)
      else setSelection({ nodes: [g.node], edges: [] })
    } else if (g.kind === 'drag' && g.started) settleDrop(g)
    else if (g.kind === 'drag' && !g.started && !g.held) {
      const node = nodeById.value.get(g.node)
      if (g.additive && g.wasSelected)
        setSelection({
          nodes: selection.value.nodes.filter((id) => id !== g.node),
          edges: selection.value.edges,
        })
      else if (!g.additive && g.wasSelected) setSelection({ nodes: [g.node], edges: [] })
      if (node) emit('nodeClick', node, event)
    }
  }
  endGesture()
}

function endGesture() {
  const g = gesture.value
  clearPress()
  cancelAnimationFrame(autoPanFrame)
  if (g && root.value?.hasPointerCapture(g.id)) root.value.releasePointerCapture(g.id)
  if ((g?.kind === 'drag' || g?.kind === 'bend') && g.started) history.close()
  if (g?.kind === 'resize') history.close()
  gesture.value = null
  guides.value = []
  dropTarget.value = null
  panning.value = false
}

/** Puts dragged nodes back where they started. */
function cancelDrag() {
  const g = gesture.value
  if ((g?.kind !== 'drag' && g?.kind !== 'bend') || !g.started) return false
  const tr = new FlowTransaction(toRaw(doc.value)).setMeta({ history: false })
  if (g.kind === 'bend') tr.updateEdge(g.edge, { data: g.origin })
  else for (const [id, o] of g.origins) tr.moveNode(id, o.x, o.y)
  if (tr.changed) commit(tr)
  history.drop(g.group)
  syncHistory()
  endGesture()
  return true
}

function onWheel(event: WheelEvent) {
  const target = event.target as Element
  if (inPanels(target)) return
  if (quickAdd.value) chooseQuickAdd(null)
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
  if (node) emit('nodeDblclick', node, event)
  else {
    const edgeEl = (event.target as Element).closest<Element>('[data-edge-id]')
    if (edgeEl) editLabel(edgeEl.getAttribute('data-edge-id')!)
  }
}

function onContextmenu(event: MouseEvent) {
  const target = event.target as Element
  if (inPanels(target)) return
  // A long press: the editor handles holding itself.
  if ((event as PointerEvent).pointerType === 'touch' || Date.now() - lastTouch < 1000) {
    event.preventDefault()
    return
  }
  // Fields inside nodes keep the browser's own menu.
  if (isEditable(target)) return
  const nodeEl = target.closest<HTMLElement>('[data-node-id]')
  const edgeEl = target.closest<Element>('[data-edge-id]')
  // From the keyboard there is no pointer: open by the focused node, or the middle.
  const keyboard = event.button === -1 || (event.clientX === 0 && event.clientY === 0)
  let client = { x: event.clientX, y: event.clientY }
  if (keyboard) {
    const box = (nodeEl ?? root.value!).getBoundingClientRect()
    client = nodeEl ? { x: box.left, y: box.bottom } : clientCenter()
  }
  const point = toCanvas(client)
  if (nodeEl) {
    const node = nodeById.value.get(nodeEl.dataset.nodeId!)
    if (!node) return
    emit('nodeContextmenu', node, event)
    if (event.defaultPrevented) return
    if (!selection.value.nodes.includes(node.id)) setSelection({ nodes: [node.id], edges: [] })
    showMenu({ kind: 'node', node, point }, client, event)
  } else if (edgeEl) {
    const edge = doc.value.edges.find((e) => e.id === edgeEl.getAttribute('data-edge-id'))
    if (!edge) return
    emit('edgeContextmenu', edge, event)
    if (event.defaultPrevented) return
    if (!selection.value.edges.includes(edge.id)) setSelection({ nodes: [], edges: [edge.id] })
    showMenu({ kind: 'edge', edge, point }, client, event)
  } else {
    emit('canvasContextmenu', point, event)
    if (event.defaultPrevented) return
    showMenu({ kind: 'canvas', point }, client, event)
  }
}

/** Opens the menu for a pointer event, keeping the browser's own when there's nothing to show. */
function showMenu(target: FlowMenuTarget, client: Point, event: Event) {
  if (target.kind === 'canvas' && event.type !== 'contextmenu') {
    // A long press: the app may want it for its own menu.
    const menuEvent = new MouseEvent('contextmenu', {
      cancelable: true,
      clientX: client.x,
      clientY: client.y,
    })
    emit('canvasContextmenu', target.point, menuEvent)
    if (menuEvent.defaultPrevented) return
  }
  if (openMenu(target, client)) event.preventDefault()
}

// Keyboard ------------------------------------------------------------------------

const isEditable = (el: Element) =>
  !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')

/** Nodes in the order Tab visits them: along the edges, left to right. */
const readingOrder = () => flowOrder(doc.value)

function focusNode(id: string) {
  // Drawn even while out of view, until it is revealed.
  focusedNode.value = id
  setSelection({ nodes: [id], edges: [] })
  reveal(id)
  void nextTick(() =>
    root.value
      ?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)
      ?.focus({ preventScroll: true }),
  )
}

/** Room around grouped nodes; more on top for the title. */
const GROUP_PAD = { side: 24, top: 56 }

/**
 * Puts nodes, the selected ones by default, into a new container of `type`
 * drawn around them, as one undo step; returns its id.
 */
function groupNodes(ids: string[] = selection.value.nodes, type = 'group') {
  const spec = types.value.get(type)
  if (props.readonly || !spec?.container) return null
  const top = tree.value.topmost(ids.filter((id) => !hiddenIn.value.has(id)))
  const bounds = boundsOf(top.flatMap((id) => getNodeRect(id) ?? []))
  if (!bounds) return null
  // Inside the container they shared, if any.
  const parents = new Set(top.map((id) => tree.value.parentOf(id)))
  const group: FlowNode = {
    ...draft(spec),
    x: snapTo(bounds.x - GROUP_PAD.side),
    y: snapTo(bounds.y - GROUP_PAD.top),
    width: snapTo(bounds.width + GROUP_PAD.side * 2),
    height: snapTo(bounds.height + GROUP_PAD.top + GROUP_PAD.side),
    parent: parents.size === 1 ? [...parents][0] : undefined,
  }
  transact((tr) => {
    // Before the nodes, so it is under them in the document's order too.
    const order = tr.doc.nodes.map((n) => n.id)
    const index = Math.min(...top.map((id) => order.indexOf(id)))
    tr.addNode(group, index)
    for (const id of top) tr.updateNode(id, { parent: group.id })
  })
  setSelection({ nodes: [group.id], edges: [] })
  announce(format(messages.value.added, { node: labelOf(spec, group) || messages.value.group }))
  return group.id
}

/** Removes a container and keeps what was inside it, as one undo step. */
function ungroup(id: string) {
  const node = nodeById.value.get(id)
  if (props.readonly || !node || !isContainer(node)) return false
  const children = tree.value.children.get(id) ?? []
  transact((tr) => {
    for (const child of children) tr.updateNode(child, { parent: node.parent })
    tr.removeNode(id)
  })
  setSelection({ nodes: [...children], edges: [] })
  return true
}

function deleteSelection() {
  const { edges } = selection.value
  // A container goes with what is inside it.
  const nodes = withInside(selection.value.nodes)
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
  const moving = carried(ids)
  transact(
    (tr) => {
      for (const id of moving) {
        const node = tr.getNode(id)
        if (node) tr.moveNode(id, node.x + dx, node.y + dy)
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
  for (const keymap of keymaps.value)
    for (const [hotkey, handler] of Object.entries(keymap))
      if (matchesHotkey(event, hotkey) && handler(event) !== false) {
        event.preventDefault()
        return
      }
  const mod = event.metaKey || event.ctrlKey
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const onCanvas = target === root.value || !!(target as HTMLElement).dataset?.nodeId

  if (mod) {
    let handled = true
    if (key === 'z' && !props.readonly) {
      if (event.shiftKey) redo()
      else undo()
    } else if (key === 'y' && !props.readonly) redo()
    else if (key === 'a') selectAll()
    // Copy, cut and paste come as clipboard events; see onClipboard.
    else if (key === 'c' || key === 'x' || key === 'v') return
    else if (key === 'd' && !props.readonly) {
      if (!selection.value.nodes.length) return
      duplicate()
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
    case 'Enter':
    case 'F2': {
      const { nodes, edges } = selection.value
      if (props.readonly || nodes.length || edges.length !== 1) return
      editLabel(edges[0]!)
      break
    }
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
    case 'e':
      if (!cycleEdges(event.shiftKey ? -1 : 1)) return
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

/**
 * Copy, cut and paste while the canvas or a node has focus. Going through the
 * clipboard events puts the nodes on the system clipboard without asking for
 * permission.
 */
function onClipboard(event: ClipboardEvent) {
  const active = document.activeElement
  if (!active || !root.value?.contains(active)) return
  if (active !== root.value && !(active as HTMLElement).dataset?.nodeId) return
  if (event.type === 'paste') {
    if (props.readonly) return
    const data = readClipboard(event.clipboardData?.getData('text/plain'))
    if (!data) return
    event.preventDefault()
    paste(data, hover ? toCanvas(hover) : null)
    return
  }
  const data = copySelection()
  if (!data) return
  event.preventDefault()
  event.clipboardData?.setData('text/plain', writeClipboard(data))
  pastes = 0
  if (event.type === 'cut' && !props.readonly) deleteSelection()
}

const clipboardEvents = ['copy', 'cut', 'paste'] as const

/** The editor's size on screen, for the minimap. */
const size = ref({ width: 0, height: 0 })
let sizeObserver: ResizeObserver | undefined

onMounted(() => {
  const el = root.value!
  size.value = { width: el.clientWidth, height: el.clientHeight }
  if (typeof ResizeObserver !== 'undefined') {
    sizeObserver = new ResizeObserver(() => {
      size.value = { width: el.clientWidth, height: el.clientHeight }
    })
    sizeObserver.observe(el)
  }
  root.value!.addEventListener('wheel', onWheel, { passive: false })
  for (const type of clipboardEvents) document.addEventListener(type, onClipboard)
})
onBeforeUnmount(() => {
  sizeObserver?.disconnect()
  cancelAnimationFrame(tweenFrame)
  for (const type of clipboardEvents) document.removeEventListener(type, onClipboard)
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

// Drawing only what is in view ----------------------------------------------------

/** How far past the editor's edges nodes and edges are still drawn, in screen px. */
const DRAW_MARGIN = 200

/** The part of the canvas that is drawn: the view and a margin around it. */
const drawnArea = computed<Rect | null>(() => {
  const { width, height } = size.value
  if (!width || !height) return null
  const { x, y, zoom } = viewport.value
  return {
    x: (-x - DRAW_MARGIN) / zoom,
    y: (-y - DRAW_MARGIN) / zoom,
    width: (width + DRAW_MARGIN * 2) / zoom,
    height: (height + DRAW_MARGIN * 2) / zoom,
  }
})

/** The node holding focus, kept drawn when it scrolls away. */
const focusedNode = ref<string | null>(null)
function onFocusin(event: FocusEvent) {
  const nodeEl = (event.target as Element).closest<HTMLElement>('[data-node-id]')
  focusedNode.value = nodeEl?.dataset.nodeId ?? null
}

/**
 * Nodes in view. A node not measured yet is drawn wherever it is, so it gets
 * a size; selected and focused ones too, so dragging and keys keep working.
 */
const drawnNodes = computed(() => {
  const area = drawnArea.value
  if (!area) return shownNodes.value.filter((node) => !hiddenIn.value.has(node.id))
  const keep = selectedNodes.value
  const hidden = hiddenIn.value
  return shownNodes.value.filter((node) => {
    if (hidden.has(node.id)) return false
    const m = metrics.get(node.id)
    if (!m || keep.has(node.id) || node.id === focusedNode.value) return true
    return intersects({ x: node.x, y: node.y, width: m.width, height: m.height }, area)
  })
})

/** Containers, drawn under the edges: outer ones first. */
const drawnContainers = computed(() =>
  drawnNodes.value
    .filter(isContainer)
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    .sort((a, b) => tree.value.depth(a.id) - tree.value.depth(b.id)),
)
const drawnOthers = computed(() => drawnNodes.value.filter((node) => !isContainer(node)))

/** Zoomed out this far, measured nodes are drawn as plain boxes. */
const simple = computed(() => viewport.value.zoom < props.simpleZoom)
/** Names below this zoom would be a few px tall: only the boxes are drawn. */
const TINY = 0.2

const classes = computed(() => ({
  'is-simple': simple.value,
  'is-tiny': simple.value && viewport.value.zoom < TINY,
  'is-readonly': props.readonly,
  'is-panning': panning.value,
  'is-space': spaceHeld.value,
  'is-dragging': !!dragging.value,
  'is-connecting': !!connecting.value,
  'is-refused': !!connecting.value?.refused,
}))

const context: FlowEditorContext = {
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
  getNodeRect,
  tidy,
  centerNode,
  announce,
  size,
  selectedNodes: computed(() => new Set(selection.value.nodes)),
  root,
  insertNode,
  paletteTypes,
  startInsertDrag,
  editLabel,
  groupNodes,
  ungroup,
  tree,
  isContainer,
  openMenu,
  toCanvas,
  copy,
  cut,
  paste: pasteFromClipboard,
  duplicate,
  deleteSelection,
  selectAll,
}
provide(flowEditorKey, context)

const keymaps = computed(() => resolved.value.keymaps.map((keymap) => keymap(context)))

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
  tidy,
  get staleEdges() {
    return [...staleEdges.value]
  },
  removeStaleEdges,
  insertNode,
  startInsertDrag,
  editLabel,
  groupNodes,
  ungroup,
  get paletteTypes() {
    return paletteTypes.value
  },
})
</script>

<template>
  <div
    ref="root"
    class="dou-flow-editor"
    :class="classes"
    :style="background"
    role="application"
    :aria-label="ariaLabel"
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
    @focusin="onFocusin"
  >
    <div class="dou-flow-editor__layer" :style="layerStyle">
      <component :is="layer" v-for="(layer, i) in resolved.below" :key="`below-${i}`" />
      <!-- Containers sit under the edges. -->
      <template v-for="node in drawnContainers" :key="node.id">
        <div
          v-if="simple && metrics.has(node.id)"
          class="dou-flow-editor__simple"
          :class="{
            'is-selected': selectedNodes.has(node.id),
            'is-drop-target': dropTarget === node.id,
          }"
          :style="{
            transform: `translate(${node.x}px, ${node.y}px)`,
            width: `${metrics.get(node.id)!.width}px`,
            height: `${metrics.get(node.id)!.height}px`,
          }"
          :data-node-id="node.id"
          role="group"
          :aria-roledescription="messages.node"
          :aria-label="labelOf(specOf(node), node)"
          tabindex="-1"
        >
          <slot name="simple" :node="node">
            <span v-if="viewport.zoom >= TINY" class="dou-flow-editor__simple-label">{{
              labelOf(specOf(node), node)
            }}</span>
          </slot>
        </div>
        <NodeView
          v-else
          :node="node"
          :spec="specOf(node)"
          :selected="selectedNodes.has(node.id)"
          :readonly="readonly"
          :dragging="!!dragging?.has(node.id)"
          :connected="connected.get(node.id) ?? none"
          :port-states="portStates ? (portStates.get(node.id) ?? noStates) : null"
          :role-description="messages.node"
          :description="describe(node)"
          :drop-target="dropTarget === node.id"
          @measure="onMeasure"
          @update="updateData"
        />
      </template>
      <svg class="dou-flow-editor__edges" aria-hidden="true">
        <g v-for="item in edgePaths" :key="item.edge.id" :data-edge-id="item.edge.id">
          <path class="dou-flow-editor__edge-hit" :d="item.route.path" />
          <path
            class="dou-flow-editor__edge"
            :style="item.style"
            :class="{
              'is-selected': item.selected,
              'is-stale': item.stale,
              'is-animated': item.edge.animated,
            }"
            :d="item.route.path"
          />
        </g>
        <path v-if="previewPath" class="dou-flow-editor__edge is-preview" :d="previewPath" />
      </svg>
      <div
        v-for="item in edgeLabels"
        :key="item.edge.id"
        class="dou-flow-editor__label"
        :class="[
          bend?.edge.id === item.edge.id && `is-bend is-${bend.handle.axis}`,
          { 'is-selected': item.selected, 'is-editing': item.edge.id === editingLabel },
        ]"
        :style="{ transform: `translate(${item.route.label.x}px, ${item.route.label.y}px)` }"
        :data-edge-id="item.edge.id"
        :data-value="item.edge.id === editingLabel ? labelDraft || ' ' : undefined"
      >
        <input
          v-if="item.edge.id === editingLabel"
          v-model="labelDraft"
          class="dou-flow-editor__label-input"
          :aria-label="messages.label"
          @keydown="onLabelKeydown"
          @blur="finishLabel(true)"
        />
        <template v-else>{{ item.edge.label }}</template>
      </div>
      <div
        v-if="bend && !bend.edge.label && editingLabel !== bend.edge.id"
        class="dou-flow-editor__bend"
        :class="`is-${bend.handle.axis}`"
        :style="{ transform: `translate(${bend.handle.at.x}px, ${bend.handle.at.y}px)` }"
        aria-hidden="true"
      />
      <template v-for="node in drawnOthers" :key="node.id">
        <div
          v-if="simple && metrics.has(node.id)"
          class="dou-flow-editor__simple"
          :class="{
            'is-selected': selectedNodes.has(node.id),
            'is-drop-target': dropTarget === node.id,
          }"
          :style="{
            transform: `translate(${node.x}px, ${node.y}px)`,
            width: `${metrics.get(node.id)!.width}px`,
            height: `${metrics.get(node.id)!.height}px`,
          }"
          :data-node-id="node.id"
          role="group"
          :aria-roledescription="messages.node"
          :aria-label="labelOf(specOf(node), node)"
          tabindex="-1"
        >
          <slot name="simple" :node="node">
            <span v-if="viewport.zoom >= TINY" class="dou-flow-editor__simple-label">{{
              labelOf(specOf(node), node)
            }}</span>
          </slot>
        </div>
        <NodeView
          v-else
          :node="node"
          :spec="specOf(node)"
          :selected="selectedNodes.has(node.id)"
          :readonly="readonly"
          :dragging="!!dragging?.has(node.id)"
          :connected="connected.get(node.id) ?? none"
          :port-states="portStates ? (portStates.get(node.id) ?? noStates) : null"
          :role-description="messages.node"
          :description="describe(node)"
          :drop-target="dropTarget === node.id"
          @measure="onMeasure"
          @update="updateData"
        />
      </template>
      <component :is="layer" v-for="(layer, i) in resolved.above" :key="`above-${i}`" />
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
      <component :is="overlay" v-for="(overlay, i) in resolved.overlays" :key="i" />
      <FlowToolbar
        v-if="toolbarItems.length && toolbarAnchor"
        :groups="toolbarItems"
        :anchor="toolbarAnchor"
        :size="size"
      />
    </div>
    <FlowMenu ref="menu" v-model:open="menuOpen" :items="menuItems" @select="runMenuItem" />
    <FlowQuickAdd :state="quickAdd" @choose="chooseQuickAdd">
      <template v-if="$slots.quickAdd" #default="scope">
        <slot name="quickAdd" v-bind="scope" />
      </template>
    </FlowQuickAdd>
    <Teleport to="body">
      <div
        v-if="insertDrag?.started"
        class="dou-flow-editor__ghost"
        :class="{ 'is-outside': !insertDrag.over }"
        :style="ghostStyle"
        aria-hidden="true"
      >
        <slot name="ghost" :spec="insertDrag.spec" :over="insertDrag.over">
          <span class="dou-flow-editor__ghost-card">
            <span v-if="insertDrag.spec.palette?.icon" class="dou-flow-editor__ghost-icon">
              <component :is="insertDrag.spec.palette.icon" />
            </span>
            {{ insertDrag.spec.palette?.label ?? insertDrag.spec.type }}
          </span>
        </slot>
      </div>
    </Teleport>
    <span ref="end" class="dou-flow-editor__end" tabindex="-1" />
    <div class="dou-flow-editor__live" aria-live="polite">{{ live }}</div>
  </div>
</template>
