import { Comment, Fragment, Text, isVNode } from 'vue'
import type { VNode } from 'vue'

/**
 * Whether rendered slot content shows anything. Comments (what a false
 * `v-if` leaves), blank text, booleans, `null`, `undefined` and fragments
 * holding only those don't. A component counts: what it renders is known
 * only once it renders, so a `v-if` that should empty the slot goes on the
 * component itself.
 */
export function rendersSomething(nodes: unknown): boolean {
  return (Array.isArray(nodes) ? nodes : [nodes]).some((node) => {
    if (!isVNode(node)) {
      if (typeof node === 'string') return node.trim() !== ''
      return typeof node === 'number'
    }
    if (node.type === Comment) return false
    if (node.type === Text) return String(node.children ?? '').trim() !== ''
    if (node.type === Fragment) return rendersSomething(node.children)
    return true
  })
}

/**
 * Renders a slot once and hands back what it rendered, or `undefined` when
 * it is not passed or renders nothing, so it counts as not passed. Call it
 * while rendering: slot content can change from one render to the next.
 */
export function filled<A extends unknown[]>(
  slot: ((...args: A) => unknown) | undefined,
  ...args: A
): VNode[] | undefined {
  if (!slot) return undefined
  const nodes = slot(...args)
  return rendersSomething(nodes) ? (nodes as VNode[]) : undefined
}

/** Puts down slot content already rendered with `filled`. */
export const SlotNodes = (props: { nodes: unknown }) => props.nodes as VNode[]
