import { defineComponent, h } from 'vue'
import { useBuilderState } from './context'
import ExpressionInput from './expression-input.vue'

/**
 * The text box for an expression: an extension's `expressionInput`, else
 * the built-in one. It is read-only while the builder is.
 */
export default defineComponent({
  name: 'DouFormBuilderExpressionBox',
  inheritAttrs: false,
  setup(_, { attrs }) {
    const state = useBuilderState()
    return () =>
      h(
        state.extensions().expressionInput ?? ExpressionInput,
        // Read-only, an example in the box would read as a value: an empty one shows a dash.
        state.readonly ? { ...attrs, readonly: true, placeholder: '—' } : attrs,
      )
  },
})
