import { defineFormBuilderExtension } from '../builder/extension'
import type { FormBuilderExtension } from '../builder/extension'
import CodeExpressionInput from './expression-input.vue'

export { expressionCodeExtension } from './extension'
export type { ExpressionCodeOptions, ExpressionFunctionInfo, ExpressionName } from './extension'
export { formExpression } from './language'
export { CodeExpressionInput }

/**
 * Writes the builder's expressions (formulas, checks, conditions as text)
 * in `@dou-ui/code`'s code input: colored, with completions, parameter
 * hints and problems underlined. Needs `@dou-ui/code` and its styles.
 */
export function codeExpressions(): FormBuilderExtension {
  return defineFormBuilderExtension({
    name: 'code-expressions',
    expressionInput: CodeExpressionInput,
  })
}
