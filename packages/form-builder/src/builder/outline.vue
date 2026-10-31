<script setup lang="ts">
import { computed, shallowReactive, watch } from 'vue'
import { ChevronRightIcon } from '@dou-ui/icons'
import { isContainer } from '../core/document'
import type { FormNode } from '../core/types'
import type { FormFieldType } from '../fields/define'
import { useBuilderState } from './context'
import type { BuilderView } from './context'
import { formNodePlaces } from './core/transaction'
import { iconOf, labelOf, nodeTitle } from './settings'

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

const types = computed(() => state.fields as Map<string, FormFieldType>)
const active = computed(() => {
  const last = state.selection[state.selection.length - 1]
  return last ? state.domId(last, 'outline') : undefined
})

function secondary(node: FormNode) {
  const type = labelOf(node.type, types.value.get(node.type), state.messages)
  const title = nodeTitle(node, types.value, state.messages)
  if (title === type) return 'name' in node && node.name && node.name !== title ? node.name : ''
  return 'name' in node && node.name && node.name !== title ? node.name : type
}
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
    <div
      v-for="row in rows"
      :id="state.domId(row.node.id, 'outline')"
      :key="row.node.id"
      class="dou-form-builder__outline-row"
      :class="{ 'is-selected': state.selected.value.has(row.node.id) }"
      role="treeitem"
      :aria-level="row.level"
      :aria-posinset="row.position"
      :aria-setsize="row.size"
      :aria-selected="state.selected.value.has(row.node.id)"
      :aria-expanded="row.container ? !folded.has(row.node.id) : undefined"
      :style="{ '--dou-form-builder-level': row.level - 1 }"
      @click="press($event, row.node.id)"
    >
      <button
        v-if="row.container"
        type="button"
        tabindex="-1"
        class="dou-form-builder__outline-toggle"
        :class="{ 'is-open': !folded.has(row.node.id) }"
        :aria-label="
          folded.has(row.node.id) ? state.messages.outline.expand : state.messages.outline.collapse
        "
        @click.stop="toggle(row.node.id)"
      >
        <ChevronRightIcon />
      </button>
      <span v-else class="dou-form-builder__outline-spacer" />
      <component
        :is="iconOf(row.node.type, types.get(row.node.type))"
        class="dou-form-builder__outline-icon"
      />
      <span class="dou-form-builder__outline-title">{{
        nodeTitle(row.node, types, state.messages)
      }}</span>
      <span class="dou-form-builder__outline-name">{{ secondary(row.node) }}</span>
    </div>
    <div v-if="!rows.length" class="dou-form-builder__outline-empty">
      {{ state.messages.canvas.empty }}
    </div>
  </div>
</template>
