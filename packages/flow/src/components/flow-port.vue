<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { flowNodeKey } from '../context'
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

onMounted(() => {
  if (el.value) node?.registerPort(props.id, el.value, props.auto)
})
onBeforeUnmount(() => node?.unregisterPort(props.id, props.auto))
</script>

<template>
  <span
    ref="el"
    class="dou-flow-port"
    :class="[`is-${side}`, `is-${port?.kind ?? 'input'}`, { 'is-connected': connected }]"
    :data-port="id"
    aria-hidden="true"
  />
</template>
