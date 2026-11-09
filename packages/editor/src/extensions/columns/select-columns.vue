<script setup lang="ts">
import { DistributeHorizontalIcon, LayoutColumnsIcon } from '@dou-ui/icons'
import { DouDropdownItem } from 'dou-ui'
import { computed } from 'vue'
import { selectBlocks } from '../../core/block-selection'
import { findBlockById, layoutOf, parentBlock } from '../../core/blocks'
import type { Block } from '../../core/model'
import { useEditor } from '../../editor'

/**
 * In the block menu of a block inside columns: select the whole set of
 * columns, to move, copy or remove it with the handle or the keyboard;
 * and, when the columns differ in width, make them even (where the bar
 * between them can't be dragged, e.g. on a touch screen).
 */
const props = defineProps<{ block: Block }>()
const { view, state, messages } = useEditor()

/** The set of columns around the block, if any. */
const row = computed(() => {
  const doc = state.value?.doc
  if (!doc) return null
  for (let info = findBlockById(doc, props.block.id); info; info = parentBlock(doc, info))
    if (layoutOf(info.node) === 'row') return info
  return null
})

/** Where the content of each column with a width of its own is. */
const uneven = computed(() => {
  const info = row.value
  if (!info?.group) return []
  const list: number[] = []
  let pos = info.contentPos + info.content.nodeSize + 1
  info.group.forEach((column) => {
    if (column.firstChild!.attrs.width != null) list.push(pos + 1)
    pos += column.nodeSize
  })
  return list
})

function select() {
  const current = view.value
  if (!current || !row.value) return
  selectBlocks(row.value.node.attrs.id as string)(current.state, current.dispatch)
  requestAnimationFrame(() => view.value?.focus())
}

function even() {
  const current = view.value
  if (!current || !uneven.value.length) return
  const tr = current.state.tr
  for (const pos of uneven.value) tr.setNodeAttribute(pos, 'width', null)
  current.dispatch(tr)
  requestAnimationFrame(() => view.value?.focus())
}
</script>

<template>
  <template v-if="row">
    <DouDropdownItem @click="select">
      <template #prefix><LayoutColumnsIcon /></template>
      {{ messages.columns.select }}
    </DouDropdownItem>
    <DouDropdownItem v-if="uneven.length" @click="even">
      <template #prefix><DistributeHorizontalIcon /></template>
      {{ messages.columns.even }}
    </DouDropdownItem>
  </template>
</template>
