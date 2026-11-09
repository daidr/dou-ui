<script setup lang="ts">
import { LayoutColumnsIcon } from '@dou-ui/icons'
import { DouDropdownItem } from 'dou-ui'
import { computed } from 'vue'
import { selectBlocks } from '../../core/block-selection'
import { findBlockById, layoutOf, parentBlock } from '../../core/blocks'
import type { Block } from '../../core/model'
import { useEditor } from '../../editor'

/**
 * In the block menu of a block inside columns: select the whole set of
 * columns, to move, copy or remove it with the handle or the keyboard.
 */
const props = defineProps<{ block: Block }>()
const { view, state, messages } = useEditor()

/** The id of the set of columns around the block, if any. */
const row = computed(() => {
  const doc = state.value?.doc
  if (!doc) return null
  for (let info = findBlockById(doc, props.block.id); info; info = parentBlock(doc, info))
    if (layoutOf(info.node) === 'row') return info.node.attrs.id as string
  return null
})

function select() {
  const current = view.value
  if (!current || !row.value) return
  selectBlocks(row.value)(current.state, current.dispatch)
  requestAnimationFrame(() => view.value?.focus())
}
</script>

<template>
  <DouDropdownItem v-if="row" @click="select">
    <template #prefix><LayoutColumnsIcon /></template>
    {{ messages.columns.select }}
  </DouDropdownItem>
</template>
