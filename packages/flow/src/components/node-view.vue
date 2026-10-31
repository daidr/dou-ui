<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import type { CSSProperties } from 'vue'
import { flowNodeKey, type NodeMetrics, type PortAnchor, type PortState } from '../context'
import type { FlowNode, FlowPortSpec, PortSide } from '../core/model'
import { portSide, portsOf, resizeOf, type NodeTypeSpec } from '../core/node-types'
import DefaultNode from './default-node.vue'
import FlowPortView from './flow-port.vue'

const props = defineProps<{
  node: FlowNode
  spec: NodeTypeSpec | undefined
  selected: boolean
  readonly: boolean
  dragging: boolean
  connected: Set<string>
  portStates: Map<string, PortState> | null
  roleDescription: string
  /** The node's accessible name. */
  label: string
  /** Read out after the name, e.g. the port counts. */
  description: string
  /** Where the nodes being dragged will be put. */
  dropTarget?: boolean
}>()
const emit = defineEmits<{
  measure: [id: string, metrics: NodeMetrics]
  update: [id: string, patch: Record<string, unknown>]
}>()

const el = useTemplateRef<HTMLElement>('el')
const ports = computed(() => portsOf(props.spec, props.node))

// Ports placed by the node's component, and the ones the editor places.
const placed = new Map<string, HTMLElement>()
const autoPlaced = new Map<string, HTMLElement>()
const placedIds = shallowRef(new Set<string>())
const mounted = shallowRef(false)

provide(flowNodeKey, {
  node: computed(() => props.node),
  ports,
  connected: computed(() => props.connected),
  portStates: computed(() => props.portStates),
  registerPort(id, portEl, auto) {
    if (auto) autoPlaced.set(id, portEl)
    else {
      placed.set(id, portEl)
      placedIds.value = new Set(placed.keys())
    }
    scheduleMeasure()
  },
  unregisterPort(id, auto) {
    if (auto) autoPlaced.delete(id)
    else {
      placed.delete(id)
      placedIds.value = new Set(placed.keys())
    }
    scheduleMeasure()
  },
})

const autoPorts = computed(() =>
  mounted.value ? ports.value.filter((port) => !placedIds.value.has(port.id)) : [],
)

/** Spreads the editor-placed ports evenly along each side. */
function autoStyle(port: FlowPortSpec): CSSProperties {
  const side = portSide(port)
  const same = autoPorts.value.filter((p) => portSide(p) === side)
  const at = `${((same.indexOf(port) + 1) / (same.length + 1)) * 100}%`
  return side === 'left' || side === 'right' ? { top: at } : { left: at }
}

function measure() {
  const node = el.value
  if (!node || !node.offsetWidth) return
  const box = node.getBoundingClientRect()
  // The canvas is scaled; measure in its own units.
  const scale = box.width / node.offsetWidth || 1
  const anchors = new Map<string, PortAnchor>()
  for (const port of ports.value) {
    const portEl = placed.get(port.id) ?? autoPlaced.get(port.id)
    if (!portEl) continue
    const rect = portEl.getBoundingClientRect()
    const side: PortSide = portSide(port)
    anchors.set(port.id, {
      x: (rect.left + rect.width / 2 - box.left) / scale,
      y: (rect.top + rect.height / 2 - box.top) / scale,
      side,
    })
  }
  emit('measure', props.node.id, {
    width: node.offsetWidth,
    height: node.offsetHeight,
    ports: anchors,
  })
}

let pending = false
function scheduleMeasure() {
  if (pending) return
  pending = true
  void nextTick(() => {
    pending = false
    measure()
  })
}

let observer: ResizeObserver | undefined
onMounted(() => {
  mounted.value = true
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure())
    observer.observe(el.value!)
  }
  scheduleMeasure()
})
onBeforeUnmount(() => observer?.disconnect())

// Content changes can move ports without resizing the node.
watch(
  () => [props.node.data, props.node.type, ports.value],
  () => scheduleMeasure(),
  { flush: 'post' },
)

const container = computed(() => !!props.spec?.container)
// A collapsed container is as tall as its content, its title.
const collapsed = computed(() => container.value && !!props.node.data?.collapsed)
const resizable = computed(
  () => !!resizeOf(props.spec, props.node) && !props.readonly && !collapsed.value,
)

const style = computed<CSSProperties>(() => ({
  transform: `translate(${props.node.x}px, ${props.node.y}px)`,
  width: props.node.width != null ? `${props.node.width}px` : undefined,
  height: props.node.height != null && !collapsed.value ? `${props.node.height}px` : undefined,
}))

const viewProps = computed(() => ({
  node: props.node,
  data: props.node.data ?? {},
  ports: ports.value,
  selected: props.selected,
  readonly: props.readonly,
  updateData: (patch: Record<string, unknown>) => emit('update', props.node.id, patch),
}))
</script>

<template>
  <div
    ref="el"
    class="dou-flow-editor__node"
    :class="{
      'is-selected': selected,
      'is-locked': node.locked,
      'is-dragging': dragging,
      'is-sized': node.width != null,
      'is-container': container,
      'is-bare': spec?.frame === false,
      'is-collapsed': collapsed,
      'is-drop-target': dropTarget,
    }"
    :style="style"
    :data-node-id="node.id"
    role="group"
    :aria-roledescription="roleDescription"
    :aria-label="label"
    :aria-description="description || undefined"
    tabindex="-1"
  >
    <component :is="spec?.component ?? DefaultNode" v-bind="viewProps" />
    <FlowPortView
      v-for="port in autoPorts"
      :id="port.id"
      :key="port.id"
      auto
      class="is-auto"
      :style="autoStyle(port)"
    />
    <span v-if="resizable && selected" class="dou-flow-editor__resize" aria-hidden="true" />
  </div>
</template>
