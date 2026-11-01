import { Comment, Fragment, Text, cloneVNode, defineComponent, h } from 'vue'
import type { ComponentPublicInstance, VNode } from 'vue'

function firstElement(nodes: VNode[]): VNode | null {
  for (const node of nodes) {
    if (node.type === Comment) continue
    if (node.type === Fragment) {
      const found = firstElement((node.children as VNode[]) ?? [])
      if (found) return found
      continue
    }
    if (node.type === Text) {
      if (!String(node.children).trim()) continue
      return h('span', null, node.children as string)
    }
    return node
  }
  return null
}

/**
 * Render the first element of the default slot, with the attributes and
 * listeners given to this component merged onto it. Lets a floating
 * component wire up its trigger without wrapping it in an extra element.
 */
export const OnlyChild = defineComponent({
  name: 'DouOnlyChild',
  inheritAttrs: false,
  setup(_, { slots, attrs }) {
    return () => {
      const child = firstElement(slots.default?.() ?? [])
      if (!child) return null
      // ids that describe the element are a list: the element's own stay with the ones given
      const own = child.props?.['aria-describedby'] as string | undefined
      const given = attrs['aria-describedby'] as string | undefined
      const describedBy = [own, given].filter(Boolean).join(' ') || undefined
      return cloneVNode(child, { ...attrs, 'aria-describedby': describedBy }, true)
    }
  },
})

/** The DOM element rendered by an `OnlyChild`, from its template ref. */
export function onlyChildElement(instance: ComponentPublicInstance | null | undefined) {
  let node = instance?.$el as Node | null | undefined
  while (node && !(node instanceof Element)) node = node.nextSibling
  return node ?? null
}
