import type { FormRule } from 'dou-ui'
import { isEmptyValue, truthy, tryCompileExpression } from './expression'
import type { FormFunction } from './expression'
import type { FormFieldNode, FormListNode, FormRuleSpec } from './types'

const patterns = new Map<string, RegExp | null>()

/** The compiled pattern, shared by every rule with the same source; `null` when it does not compile. */
function compile(source: string, flags = ''): RegExp | null {
  const key = `${flags}/${source}`
  let pattern = patterns.get(key)
  if (pattern === undefined) {
    try {
      pattern = new RegExp(source, flags.replace(/[gy]/g, ''))
    } catch {
      pattern = null
      console.warn(`[dou-ui] form rule pattern /${source}/${flags} does not compile; it is ignored`)
    }
    patterns.set(key, pattern)
  }
  return pattern
}

/** One rule as data, as the form's own rule. `functions` are what a `check` can call besides the built-in ones. */
export function toFormRule(
  spec: FormRuleSpec,
  functions?: Readonly<Record<string, FormFunction>>,
  item?: () => unknown,
): FormRule {
  const { pattern, flags, check, ...rest } = spec
  const rule: FormRule = rest
  if (pattern !== undefined) {
    const compiled = compile(pattern, flags)
    if (compiled) rule.pattern = compiled
  }
  if (check !== undefined) {
    const expression = tryCompileExpression(check)
    if (expression)
      rule.validator = (value, model) =>
        isEmptyValue(value) ||
        truthy(expression.evaluate({ values: model, value, item: item?.(), functions }))
  }
  return rule
}

export interface RulesOptions {
  /** Whether the field is required, when that is decided elsewhere. Defaults to the node's `required`. */
  required?: boolean
  /** What `check` expressions can call besides the built-in functions. */
  functions?: Readonly<Record<string, FormFunction>>
  /** Inside a list, the item the field belongs to, read as `item` by `check`. */
  item?: () => unknown
}

interface Cached {
  specs: FormRuleSpec[] | undefined
  required: boolean
  functions: RulesOptions['functions']
  item: RulesOptions['item']
  rules: FormRule[]
}

const cache = new WeakMap<object, Cached>()

/**
 * The rules of a field node, `required` first. Cached per node while its
 * `rules`, whether it is required and the functions stay the same, so
 * re-renders hand the form item the same array.
 */
export function rulesOf(
  node: FormFieldNode | FormListNode,
  options: RulesOptions = {},
): FormRule[] {
  const required = options.required ?? node.required ?? false
  const { functions, item } = options
  const cached = cache.get(node)
  if (
    cached &&
    cached.specs === node.rules &&
    cached.required === required &&
    cached.functions === functions &&
    cached.item === item
  )
    return cached.rules
  const rules = (node.rules ?? []).map((spec) => toFormRule(spec, functions, item))
  if (required && !rules.some((rule) => rule.required)) rules.unshift({ required: true })
  cache.set(node, { specs: node.rules, required, functions, item, rules })
  return rules
}
