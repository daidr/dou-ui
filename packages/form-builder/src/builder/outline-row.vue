<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRightIcon } from '@dou-ui/icons'
import type { FormNode } from '../core/types'
import type { FormFieldType } from '../fields/define'
import { useBuilderState } from './context'
import { iconOf, labelOf, nodeTitle } from './settings'

defineOptions({ name: 'DouFormBuilderOutlineRow' })

// One row is its own component, so a change to one node of a large form
// draws only that row again.
const props = defineProps<{
  node: FormNode
  level: number
  position: number
  size: number
  container: boolean
  open: boolean
  selected: boolean
}>()
const emit = defineEmits<{ press: [event: MouseEvent]; toggle: [] }>()

const state = useBuilderState()
const types = computed(() => state.fields as Map<string, FormFieldType>)

const title = computed(() => nodeTitle(props.node, types.value, state.messages))
const secondary = computed(() => {
  const node = props.node
  const type = labelOf(node.type, types.value.get(node.type), state.messages)
  const name = 'name' in node && node.name && node.name !== title.value ? node.name : ''
  return title.value === type ? name : name || type
})

/** The extensions' marks of the node, as dots in their colors. */
const marks = computed(() => state.extensions().marks.flatMap((mark) => mark(state, props.node)))
</script>

<template>
  <div
    :id="state.domId(node.id, 'outline')"
    class="dou-form-builder__outline-row"
    :class="{ 'is-selected': selected }"
    role="treeitem"
    :aria-level="level"
    :aria-posinset="position"
    :aria-setsize="size"
    :aria-selected="selected"
    :aria-expanded="container ? open : undefined"
    :style="{ '--dou-form-builder-level': level - 1 }"
    @click="emit('press', $event)"
  >
    <button
      v-if="container"
      type="button"
      tabindex="-1"
      class="dou-form-builder__outline-toggle"
      :class="{ 'is-open': open }"
      :aria-label="open ? state.messages.outline.collapse : state.messages.outline.expand"
      @click.stop="emit('toggle')"
    >
      <ChevronRightIcon />
    </button>
    <span v-else class="dou-form-builder__outline-spacer" />
    <component
      :is="iconOf(node.type, types.get(node.type))"
      class="dou-form-builder__outline-icon"
    />
    <span class="dou-form-builder__outline-title">{{ title }}</span>
    <span class="dou-form-builder__outline-name">{{ secondary }}</span>
    <span
      v-for="mark in marks"
      :key="mark.key"
      class="dou-form-builder__outline-mark"
      :style="mark.color ? { '--dou-form-builder-mark': mark.color } : undefined"
      :title="mark.label"
      aria-hidden="true"
    />
  </div>
</template>
