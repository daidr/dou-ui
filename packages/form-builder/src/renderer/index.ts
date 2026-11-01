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
  FormValidator,
  FormValidatorContext,
} from './context'
export { findFormulaCycles, findItemFormulaCycles } from '../core/formulas'
export { checkDocument, checkDocumentShape, migrateDocument } from '../core/check'
export type { CheckDocumentOptions, DocumentProblem, DocumentShapeProblem } from '../core/check'
export { emptyItem, fillValues, startValue, visibleValues } from '../core/values'
export type { VisibleValuesOptions } from '../core/values'
export { formatMessage, formRendererLocales, useFormRendererMessages } from '../locale'
export type { FormRendererMessages, FormRendererMessagesOverride } from '../locale'
export { builtinFields, resolveFields } from '../fields/builtin'
export { defineFormField, fieldProps, useFormField } from '../fields/define'
export type { FormFieldContext, FormFieldProps, FormFieldType } from '../fields/define'
export { normalizeOptions } from '../fields/components'
export { formatValue } from '../fields/format'
export type { FormFormatContext } from '../fields/format'
export { fitPathToOptions, fitToOptions } from '../fields/options'
export type { FormOption } from '../fields/components'
export {
  cloneValue,
  createId,
  emptyDocument,
  fieldNodes,
  findNode,
  getPath,
  isContainer,
  isField,
  isList,
  isPage,
  isSection,
  isSteps,
  isTabs,
  setPath,
  unsetPath,
  valueNodes,
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
  FormContainerNode,
  FormDocument,
  FormFieldNode,
  FormListNode,
  FormNode,
  FormOptionSource,
  FormPageNode,
  FormResponsive,
  FormRuleSpec,
  FormSectionNode,
  FormStepsNode,
  FormTabsNode,
} from '../core/types'

export type FormRendererInstance = InstanceType<typeof FormRenderer>

declare module 'vue' {
  export interface GlobalComponents {
    DouFormRenderer: typeof DouFormRenderer
  }
}
