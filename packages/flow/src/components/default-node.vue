<script setup lang="ts">
import { computed } from 'vue'
import { portSide, type NodeViewProps } from '../core/node-types'
import { useFlowEditor } from '../context'
import type { DefaultNodeData } from './default-node'
import FlowPortView from './port-view.vue'

const props = defineProps<NodeViewProps<DefaultNodeData>>()
const { messages } = useFlowEditor()

// Ports on the top or bottom are placed by the editor.
const inputs = computed(() =>
  props.ports.filter((p) => p.kind === 'input' && portSide(p) === 'left'),
)
const outputs = computed(() =>
  props.ports.filter((p) => p.kind === 'output' && portSide(p) === 'right'),
)
// A single unnamed input and output sit on the title row.
const inline = computed(
  () =>
    inputs.value.length <= 1 &&
    outputs.value.length <= 1 &&
    [...inputs.value, ...outputs.value].every((p) => !p.label),
)
const rows = computed(() => {
  if (inline.value) return []
  const count = Math.max(inputs.value.length, outputs.value.length)
  return Array.from({ length: count }, (_, i) => ({
    input: inputs.value[i],
    output: outputs.value[i],
  }))
})
</script>

<template>
  <div class="dou-flow-default-node">
    <div class="dou-flow-default-node__head">
      <FlowPortView v-if="inline && inputs[0]" :id="inputs[0].id" />
      <span v-if="data.icon" class="dou-flow-default-node__icon">
        <component :is="data.icon" />
      </span>
      <span class="dou-flow-default-node__title">{{ data.label }}</span>
      <span
        v-if="data.status"
        class="dou-flow-default-node__status"
        :class="`is-${data.status}`"
        role="img"
        :aria-label="messages.status[data.status]"
      />
      <FlowPortView v-if="inline && outputs[0]" :id="outputs[0].id" />
    </div>
    <p v-if="data.description" class="dou-flow-default-node__description">
      {{ data.description }}
    </p>
    <div v-if="rows.length" class="dou-flow-default-node__ports">
      <div v-for="(row, i) in rows" :key="i" class="dou-flow-default-node__row">
        <span v-if="row.input" class="dou-flow-default-node__port is-input">
          <FlowPortView :id="row.input.id" />
          {{ row.input.label ?? messages.input }}
        </span>
        <span v-if="row.output" class="dou-flow-default-node__port is-output">
          {{ row.output.label ?? messages.output }}
          <FlowPortView :id="row.output.id" />
        </span>
      </div>
    </div>
  </div>
</template>
