import { withInstall } from 'dou-ui'
import FormRenderer from './form-renderer.vue'

export const DouFormRenderer = withInstall(FormRenderer)
export default DouFormRenderer

export type {
  FormRendererEmits,
  FormRendererExpose,
  FormRendererProps,
  FormRendererSlots,
  FormOptionsLoader,
} from './context'
export { findFormulaCycles } from './formulas'
export { builtinFields, resolveFields } from '../fields/builtin'
export { defineFormField, fieldProps, useFormField } from '../fields/define'
export type { FormFieldContext, FormFieldProps, FormFieldType } from '../fields/define'
export { normalizeOptions } from '../fields/components'
export { fitPathToOptions, fitToOptions } from '../fields/options'
export type { FormOption } from '../fields/components'
export {
  cloneValue,
  createId,
  emptyDocument,
  fieldNodes,
  findNode,
  getPath,
  isSection,
  setPath,
  walkNodes,
} from '../core/document'
export { rulesOf, toFormRule } from '../core/rules'
export type { RulesOptions } from '../core/rules'
export {
  builtinFunctions,
  checkExpression,
  compileExpression,
  equalValues,
  evaluateExpression,
  ExpressionError,
  isEmptyValue,
  parseExpression,
  truthy,
} from '../core/expression'
export type {
  BinaryOperator,
  CompiledExpression,
  ExpressionErrorCode,
  ExpressionNode,
  ExpressionProblem,
  ExpressionScope,
  FormFunction,
} from '../core/expression'
export type {
  FormBreakpoint,
  FormDocument,
  FormFieldNode,
  FormNode,
  FormOptionSource,
  FormResponsive,
  FormRuleSpec,
  FormSectionNode,
} from '../core/types'

export type FormRendererInstance = InstanceType<typeof FormRenderer>

declare module 'vue' {
  export interface GlobalComponents {
    DouFormRenderer: typeof DouFormRenderer
  }
}
