import {
  Comment,
  Fragment,
  Text,
  cloneVNode,
  defineComponent,
  getCurrentInstance,
  h,
  mergeProps,
  onMounted,
} from 'vue'
import type { Component, ComponentPublicInstance, HTMLAttributes, VNode } from 'vue'
import type { WithAttributes } from './install'
import { devWarn } from './status-check'

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
    const probe = useProbe(attrs)
    return () => {
      const child = firstElement(slots.default?.() ?? [])
      if (!child) return null
      // probes of the components around are kept: each checks its own listeners
      const given = probe ? mergeProps(attrs, { onDouProbe: probe }) : attrs
      if (triggerHosts.has(child.type as object)) return passToTrigger(child, { ...given })
      // ids that describe the element are a list: the element's own stay with the ones given
      const own = child.props?.['aria-describedby'] as string | undefined
      const theirs = attrs['aria-describedby'] as string | undefined
      const describedBy = [own, theirs].filter(Boolean).join(' ') || undefined
      return cloneVNode(child, { ...given, 'aria-describedby': describedBy }, true)
    }
  },
})

/*
 * While developing: check once that the listeners reached an element. A
 * component in the slot that keeps its attributes for something else
 * (say a wrapper whose root is a DouDropdown, which puts them on its
 * panel) leaves the trigger without them, and nothing else would say so.
 */
function useProbe(attrs: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return undefined
  const instance = getCurrentInstance()
  let reached = false
  onMounted(() => {
    if (!Object.keys(attrs).some((key) => /^on[A-Z]/.test(key) && key !== 'onDouProbe')) return
    const root = onlyChildElement(instance?.proxy)
    if (!root) return
    // the listeners may sit on an element inside the root, not on the root itself
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
    let node: Node | null = root
    for (let n = 0; node && n < 500; n++) {
      node.dispatchEvent(new Event('dou-probe'))
      if (reached) return
      node = walker.nextNode()
    }
    // a trigger too large to look through is given the benefit of the doubt
    if (node) return
    const owner = (instance?.parent?.type as { name?: string } | undefined)?.name ?? 'DouOnlyChild'
    devWarn(
      `[dou-ui] ${owner}: its trigger got none of its listeners. The component in the default slot keeps its attributes for something else, e.g. your own component whose root is a DouPopover or DouDropdown. Put ${owner} inside that component, right around the overlay, or wrap the slot in an element.`,
    )
  })
  return () => (reached = true)
}

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
