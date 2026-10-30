<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { flowEditorKey, flowNodeKey } from '../context'
import { portSide } from '../core/node-types'

defineOptions({ name: 'DouFlowPort' })

const props = defineProps<{
  /** The id of one of the node's ports. */
  id: string
  /** @internal placed by the editor, not by the node's component */
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
    aria-hidden="true"
  >
    <svg v-if="shape === 'triangle'" viewBox="0 0 10 10">
      <path d="M2.5 1.5 8.5 5 2.5 8.5Z" />
    </svg>
  </span>
</template>
