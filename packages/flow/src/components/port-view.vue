<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { flowEditorKey, flowNodeKey } from '../context'
import type { FlowPortVisible } from '../core/model'
import { portSide } from '../core/node-types'

defineOptions({ name: 'DouFlowPortView' })

// The port itself. `<DouFlowPort>` is the public face; the editor places
// the ports a node's component leaves out with `auto`.
const props = defineProps<{
  id: string
  visible?: FlowPortVisible
  /** placed by the editor, not by the node's component */
  auto?: boolean
}>()

const node = inject(flowNodeKey, null)

const el = useTemplateRef<HTMLElement>('el')
const port = computed(() => node?.ports.value.find((p) => p.id === props.id))
const side = computed(() => (port.value ? portSide(port.value) : 'left'))
const connected = computed(() => !!node?.connected.value.has(props.id))
const editor = inject(flowEditorKey, null)
const type = computed(() => (port.value ? editor?.portTypeOf(port.value) : undefined))
const shape = computed(() => type.value?.shape ?? 'circle')
const color = computed(() => editor?.colorOf(type.value))
const visible = computed(() => props.visible ?? port.value?.visible ?? 'always')
const states = computed(() => node?.portStates.value)
const state = computed(() => states.value?.get(props.id))

onMounted(() => {
  if (el.value) node?.registerPort(props.id, el.value, props.auto)
})
onBeforeUnmount(() => node?.unregisterPort(props.id, props.auto))
</script>

<template>
  <span
    ref="el"
    class="dou-flow-port"
    :class="[
      `is-${side}`,
      `is-${port?.kind ?? 'input'}`,
      `is-${shape}`,
      state && `is-${state}`,
      { 'is-connected': connected, 'is-unavailable': states && !state },
    ]"
    :style="color ? { '--dou-flow-port-color': color } : undefined"
    :data-port="id"
    :data-visible="visible === 'always' ? undefined : visible"
    aria-hidden="true"
  >
    <svg v-if="shape === 'triangle'" viewBox="0 0 10 10">
      <path d="M2 1.5 8 5 2 8.5Z" />
    </svg>
  </span>
</template>
