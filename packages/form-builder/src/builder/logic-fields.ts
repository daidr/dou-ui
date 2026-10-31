import { defineFormField } from '../fields/define'
import ConditionEditor from './condition-editor.vue'
import ExpressionInput from './expression-input.vue'
import { CONDITION_TYPE, EXPRESSION_TYPE } from './settings'

export const expressionField = defineFormField({
  type: EXPRESSION_TYPE,
  component: ExpressionInput,
  empty: () => '',
})

export const conditionField = defineFormField({
  type: CONDITION_TYPE,
  component: ConditionEditor,
  empty: () => '',
})
