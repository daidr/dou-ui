import {
  Comment,
  Fragment,
  Text,
  defineComponent,
  h,
  inject,
  isVNode,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  useTemplateRef,
} from 'vue'
import type { InjectionKey, PropType, VNode } from 'vue'

/**
 * A button in the prefix or suffix of a field (DouInput, DouInputNumber)
 * acts for the field: it is disabled with it, and the field sets its height.
 */
export interface FieldActionContext {
  disabled: () => boolean
}

export const fieldActionKey: InjectionKey<FieldActionContext | undefined> =
  Symbol('dou-field-action')

/** The field a button sits in as an action, if any. */
export function useFieldAction(): FieldActionContext | undefined {
  return inject(fieldActionKey, undefined)
}

const ACTIONS = ['DouButton', 'DouCopyButton']
const ACTION_SELECTOR = '.dou-button, .dou-copy-button'

/** The outermost node that shows something, or undefined. */
function edgeNode(nodes: unknown, side: 'start' | 'end'): unknown {
  const list = Array.isArray(nodes) ? nodes : [nodes]
  for (let i = 0; i < list.length; i++) {
    const node: unknown = list[side === 'start' ? i : list.length - 1 - i]
    if (!isVNode(node)) {
      if (typeof node === 'string' ? node.trim() !== '' : typeof node === 'number') return node
      continue
    }
    if (node.type === Comment) continue
    if (node.type === Text) {
      if (String(node.children ?? '').trim() !== '') return node
      continue
    }
    if (node.type === Fragment) {
      const inner = edgeNode(node.children, side)
      if (inner !== undefined) return inner
      continue
    }
    return node
  }
  return undefined
}

/** Whether rendered slot content starts or ends with a button, as far as the vnodes tell. */
function guessEdge(nodes: unknown, side: 'start' | 'end'): boolean {
  const node = edgeNode(nodes, side)
  if (!isVNode(node) || typeof node.type !== 'object') return false
  return ACTIONS.includes((node.type as { name?: string }).name ?? '')
}

/** Whether the element's first or last node in the flow is a button. */
function measureEdge(el: Element, side: 'start' | 'end'): boolean {
  const nodes = el.childNodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[side === 'start' ? i : nodes.length - 1 - i]!
    if (node.nodeType === Node.COMMENT_NODE) continue
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent!.trim() === '') continue
      return false
    }
    if (!(node instanceof Element)) continue
    const style = getComputedStyle(node)
    // a panel kept in place (`teleport: false`) is out of the flow
    if (style.display === 'none' || style.position === 'absolute' || style.position === 'fixed')
      continue
    if (style.display === 'contents') return measureEdge(node, side)
    return node.matches(ACTION_SELECTOR)
  }
  return false
}

/**
 * The prefix or suffix of a field. Renders the slot once, lets the buttons
 * in it know they act for the field, and marks itself `is-edge-action` when
 * its outermost content is a button, so the field can give that button the
 * padding on its side. The vnodes give a first answer, which holds for
 * server rendering; once mounted the DOM decides, which also sees a button
 * wrapped in another component.
 */
export const FieldAffix = defineComponent({
  name: 'DouFieldAffix',
  props: {
    side: { type: String as PropType<'start' | 'end'>, required: true },
    disabled: { type: Boolean, default: false },
    render: { type: Function as PropType<() => unknown>, required: true },
  },
  setup(props) {
    provide(fieldActionKey, { disabled: () => props.disabled })
    const el = useTemplateRef<HTMLElement>('el')
    const measured = ref<boolean>()
    let observer: MutationObserver | undefined
    const measure = () => {
      if (el.value) measured.value = measureEdge(el.value, props.side)
    }
    onMounted(() => {
      measure()
      if (typeof MutationObserver === 'undefined' || !el.value) return
      observer = new MutationObserver(measure)
      observer.observe(el.value, { childList: true, characterData: true, subtree: true })
    })
    onBeforeUnmount(() => observer?.disconnect())
    return () => {
      const nodes = props.render()
      const edge = measured.value ?? guessEdge(nodes, props.side)
      return h('span', { ref: 'el', class: { 'is-edge-action': edge } }, nodes as VNode[])
    }
  },
})
