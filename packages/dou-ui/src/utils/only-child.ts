import { Comment, Fragment, Text, cloneVNode, defineComponent, h } from 'vue'
import type { Component, ComponentPublicInstance, HTMLAttributes, VNode } from 'vue'
import type { WithAttributes } from './install'

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

/*
 * Components whose default slot is their trigger (a tooltip, a popover, a
 * menu). Nested inside one another, each would hand its listeners to the
 * outer component, which keeps them for its own panel. So when the child
 * is one of these, the attributes go on to its slot instead and reach the
 * element both of them anchor to.
 */
const triggerHosts = new WeakSet<object>()

/** Marks a component whose default slot is its trigger, rendered through `OnlyChild`. */
export function forwardsTrigger<T extends Component>(component: T): T {
  triggerHosts.add(component)
  return component
}

// PatchFlags.DYNAMIC_SLOTS: the replaced slot differs on every render
const DYNAMIC_SLOTS = 1 << 10

function passToTrigger(host: VNode, attrs: Record<string, unknown>): VNode {
  const slots = host.children as Record<string, unknown> | null
  const inner = slots?.default
  if (typeof inner !== 'function') return host
  // without `_` and `$stable` the slots are taken as new on every render
  const { _: _compiled, $stable: _stable, ...rest } = slots!
  const passed = cloneVNode(host)
  passed.children = {
    ...rest,
    default: (...args: unknown[]) => [
      h(OnlyChildComponent, attrs, {
        default: () => (inner as (...a: unknown[]) => VNode[])(...args),
      }),
    ],
  }
  if (passed.patchFlag >= 0) passed.patchFlag |= DYNAMIC_SLOTS
  return passed
}

/**
 * Render the first element of the default slot, with the attributes and
 * listeners given to this component merged onto it. Lets a floating
 * component wire up its trigger without wrapping it in an extra element.
 */
const OnlyChildComponent = defineComponent({
  name: 'DouOnlyChild',
  inheritAttrs: false,
  setup(_, { slots, attrs }) {
    return () => {
      const child = firstElement(slots.default?.() ?? [])
      if (!child) return null
      if (triggerHosts.has(child.type as object)) return passToTrigger(child, { ...attrs })
      // ids that describe the element are a list: the element's own stay with the ones given
      const own = child.props?.['aria-describedby'] as string | undefined
      const given = attrs['aria-describedby'] as string | undefined
      const describedBy = [own, given].filter(Boolean).join(' ') || undefined
      return cloneVNode(child, { ...attrs, 'aria-describedby': describedBy }, true)
    }
  },
})

/** 属性和事件都转交给插槽里的元素，所以模板里可以写任何原生属性。 */
export const OnlyChild = OnlyChildComponent as WithAttributes<
  typeof OnlyChildComponent,
  HTMLAttributes
>

/** The DOM element rendered by an `OnlyChild`, from its template ref. */
export function onlyChildElement(instance: ComponentPublicInstance | null | undefined) {
  let node = instance?.$el as Node | null | undefined
  while (node && !(node instanceof Element)) node = node.nextSibling
  return node ?? null
}
