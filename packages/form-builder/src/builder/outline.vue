<script setup lang="ts">
import { computed, shallowReactive, watch } from 'vue'
import { isContainer } from '../core/document'
import type { FormNode } from '../core/types'
import { useBuilderState } from './context'
import type { BuilderView } from './context'
import { formNodePlaces } from './core/transaction'
import OutlineRow from './outline-row.vue'

defineOptions({ name: 'DouFormBuilderOutline' })

const state = useBuilderState()
/** Containers folded away. */
const folded = shallowReactive(new Set<string>())

interface Row {
  node: FormNode
  level: number
  position: number
  size: number
  container: boolean
}

const rows = computed(() => {
  const result: Row[] = []
  const visit = (nodes: readonly FormNode[], level: number) => {
    nodes.forEach((node, index) => {
      const container = isContainer(node) && node.children.length > 0
      result.push({ node, level, position: index + 1, size: nodes.length, container })
      if (container && !folded.has(node.id))
        visit((node as { children: FormNode[] }).children, level + 1)
    })
  }
  visit(state.document.nodes, 1)
  return result
})

// A folded container opens when something inside it is selected.
watch(
  () => state.selection,
  (ids) => {
    const map = formNodePlaces(state.document)
    for (const id of ids) {
      let parent = map.get(id)?.parent
      while (parent) {
        folded.delete(parent.id)
        parent = map.get(parent.id)?.parent
      }
    }
  },
)

const view: BuilderView = {
  name: 'outline',
  order: () => rows.value.map((row) => row.node.id),
  expand: (id) => {
    if (!folded.has(id)) return false
    folded.delete(id)
    return true
  },
  collapse: (id) => {
    const node = formNodePlaces(state.document).get(id)?.node
    if (!node || !isContainer(node) || !node.children.length || folded.has(id)) return false
    folded.add(id)
    return true
  },
}

function toggle(id: string) {
  if (folded.has(id)) folded.delete(id)
  else folded.add(id)
}

function press(event: MouseEvent, id: string) {
  state.pick(id, event, view)
}

const active = computed(() => {
  const last = state.selection[state.selection.length - 1]
  return last ? state.domId(last, 'outline') : undefined
})
</script>

<template>
  <div
    class="dou-form-builder__outline"
    role="tree"
    tabindex="0"
    aria-multiselectable="true"
    :aria-label="state.messages.outline.label"
    :aria-activedescendant="active"
    @keydown="state.keydown($event, view)"
  >
    <OutlineRow
      v-for="row in rows"
      :key="row.node.id"
      :node="row.node"
      :level="row.level"
      :position="row.position"
      :size="row.size"
      :container="row.container"
      :open="row.container && !folded.has(row.node.id)"
      :selected="state.selected.value.has(row.node.id)"
      @press="press($event, row.node.id)"
      @toggle="toggle(row.node.id)"
    />
    <div v-if="!rows.length" class="dou-form-builder__outline-empty">
      {{ state.messages.canvas.empty }}
    </div>
  </div>
</template>
