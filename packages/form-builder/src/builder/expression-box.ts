import { defineComponent, h } from 'vue'
import { useBuilderState } from './context'
import ExpressionInput from './expression-input.vue'

/** The text box for an expression: an extension's `expressionInput`, else the built-in one. */
export default defineComponent({
  name: 'DouFormBuilderExpressionBox',
  inheritAttrs: false,
  setup(_, { attrs }) {
    const state = useBuilderState()
    return () => h(state.extensions().expressionInput ?? ExpressionInput, attrs)
  },
})
