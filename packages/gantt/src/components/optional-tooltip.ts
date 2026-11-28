import { DouTooltip } from 'dou-ui'
import { defineComponent, h } from 'vue'

/**
 * Wraps a trigger element in `DouTooltip` only when `enabled` is true, avoiding
 * popup instances on every bar/marker when no tooltip slot is provided.
 */
export const OptionalTooltip = defineComponent({
  name: 'DouGanttOptionalTooltip',
  props: {
    enabled: Boolean,
    disabled: Boolean,
    showDelay: { type: Number, default: 120 },
    hideDelay: { type: Number, default: 80 },
  },
  setup(props, { slots }) {
    return () => {
      if (!props.enabled) return slots.default?.()
      return h(
        DouTooltip,
        {
          disabled: props.disabled,
          showDelay: props.showDelay,
          hideDelay: props.hideDelay,
        },
        {
          default: () => slots.default?.(),
          content: () => slots.content?.(),
        },
      )
    }
  },
})
