<script setup lang="ts">
import { Comment, Fragment, Text, inject, isVNode, useTemplateRef } from 'vue'
import type { FunctionalComponent, VNode } from 'vue'
import { useResizeObserver } from '../../composables/use-element-size'
import { useNamespace } from '../../utils/namespace'
import { menuKey } from './menu'
import type { MenuItemOption } from './menu'

defineOptions({ name: 'DouMenuActions' })

const props = defineProps<{ item: MenuItemOption; selected: boolean }>()

const ns = useNamespace('menu')
const menu = inject(menuKey)!

/** Whether the slot drew anything for this item: it may leave most items alone. */
function drawn(nodes: unknown): boolean {
  if (!Array.isArray(nodes)) return false
  return nodes.some((node) => {
    if (!isVNode(node)) return node != null && node !== false && node !== ''
    if (node.type === Comment) return false
    if (node.type === Text) return String(node.children ?? '').trim() !== ''
    if (node.type === Fragment) return drawn(node.children)
    return true
  })
}

const nodes = () =>
  menu.actionsSlot()?.({ item: props.item, selected: props.selected }) as VNode[] | undefined
const Actions: FunctionalComponent = () => nodes()

// The item keeps clear of the actions laid over its end: it takes their
// width as end padding (see menu.css).
const el = useTemplateRef<HTMLElement>('el')
useResizeObserver(el, ([entry]) => {
  const li = el.value?.parentElement
  if (li && entry) li.style.setProperty('--dou-menu-actions-width', `${entry.contentRect.width}px`)
})
</script>

<template>
  <!-- beside the item, never in it: a button may not hold another one -->
  <span v-if="drawn(nodes())" ref="el" :class="ns.e('actions')"><Actions /></span>
</template>
