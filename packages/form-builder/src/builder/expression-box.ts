import { defineComponent, h } from 'vue'
import { useBuilderState } from './context'
import ExpressionInput from './expression-input.vue'

const ExpressionBox = defineComponent({
  name: 'DouFormBuilderExpressionBox',
  inheritAttrs: false,
  setup(_, { attrs }) {
    const state = useBuilderState()
    return () => h(state.extensions().expressionInput ?? ExpressionInput, attrs)
  },
})

/**
 * The text box for an expression: an extension's `expressionInput`, else the built-in one.
 * Everything given to it goes on to that box, so it takes what the built-in one takes.
 */
export default ExpressionBox as unknown as typeof ExpressionInput
