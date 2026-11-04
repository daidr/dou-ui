<script lang="ts">
import {
  Comment,
  Fragment,
  Text,
  defineComponent,
  h,
  type PropType,
  type SlotsType,
  type VNode,
} from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { StatusDotSize, StatusDotSlots, StatusDotTone } from './status-dot'

/** Whether rendered slot content shows anything: comments, `v-if`s and empty text don't. */
function hasContent(nodes: VNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === Comment) return false
    if (node.type === Text) return String(node.children ?? '').trim() !== ''
    if (node.type === Fragment)
      return Array.isArray(node.children) && hasContent(node.children as VNode[])
    return true
  })
}

// A render function rather than a template: slots and attrs are not reactive,
// so whether text sits beside the dot is read on every render, from what the
// slot actually renders.
export default defineComponent({
  name: 'DouStatusDot',
  props: {
    tone: { type: String as PropType<StatusDotTone>, default: 'neutral' },
    size: { type: String as PropType<StatusDotSize>, default: 'md' },
    ripple: { type: Boolean, default: false },
    label: { type: String, default: undefined },
  },
  slots: Object as SlotsType<StatusDotSlots>,
  setup(props, { slots, attrs }) {
    const ns = useNamespace('status-dot')
    return () => {
      const content = slots.default?.() as VNode[] | undefined
      const text = !!content && hasContent(content)
      // With text beside it the text speaks for the dot; a bare dot speaks
      // through `label`, or an `aria-label` written on it directly.
      const label = text ? undefined : (props.label ?? (attrs['aria-label'] as string | undefined))
      return h(
        'span',
        {
          class: [ns.b(), ns.m(props.tone), ns.m(props.size), ns.is('ripple', props.ripple)],
          role: label ? 'img' : undefined,
          'aria-label': label,
          'aria-hidden': !text && !label ? 'true' : undefined,
        },
        [
          h('span', { class: ns.e('dot'), 'aria-hidden': 'true' }),
          text ? h('span', { class: ns.e('label') }, content) : null,
        ],
      )
    }
  },
})
</script>
