<script lang="ts">
import { defineComponent, h, type SlotsType, type VNode } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { rendersSomething } from '../../utils/slot'
import { statusDotProps, type StatusDotSlots } from './status-dot'

// A render function rather than a template: slots and attrs are not reactive,
// so whether text sits beside the dot is read on every render, from what the
// slot actually renders.
export default defineComponent({
  name: 'DouStatusDot',
  props: statusDotProps,
  slots: Object as SlotsType<StatusDotSlots>,
  setup(props, { slots, attrs }) {
    const ns = useNamespace('status-dot')
    return () => {
      const content = slots.default?.() as VNode[] | undefined
      const text = rendersSomething(content)
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
