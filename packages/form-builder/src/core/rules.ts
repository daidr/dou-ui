import type { FormRule } from 'dou-ui'
import { isEmptyValue, truthy, tryCompileExpression } from './expression'
import type { FormFunction } from './expression'
import type { FormFieldNode, FormListNode, FormRuleSpec, FormValidator } from './types'

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
      console.warn(
        `[@dou-ui/form-builder] form rule pattern /${source}/${flags} does not compile; it is ignored`,
      )
    }
    patterns.set(key, pattern)
  }
  return pattern
}

const warnedValidators = new Set<string>()
function warnValidator(name: string) {
  if (process.env.NODE_ENV === 'production' || warnedValidators.has(name)) return
  warnedValidators.add(name)
  console.warn(
    `[@dou-ui/form-builder] there is no validator "${name}" in \`validators\`; the rule passes`,
  )
}

/** One rule as data, as the form's own rule. */
export function toFormRule(spec: FormRuleSpec, options: RulesOptions = {}): FormRule {
  const { pattern, flags, check, validator, ...rest } = spec
  const { functions, validators, item, path } = options
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
  } else if (validator !== undefined)
    rule.validator = (value, model) => {
      if (isEmptyValue(value)) return true
      const run = validators?.[validator]
      if (!run) {
        warnValidator(validator)
        return true
      }
      return run(value, { values: model, item: item?.() ?? null, path: path?.() ?? '' })
    }
  return rule
}

export interface RulesOptions {
  /** Whether the field is required, when that is decided elsewhere. Defaults to the node's `required`. */
  required?: boolean
  /** What `check` expressions can call besides the built-in functions. */
  functions?: Readonly<Record<string, FormFunction>>
  /** The checks a rule's `validator` names. */
  validators?: Readonly<Record<string, FormValidator>>
  /** Inside a list, the item the field belongs to, read as `item` by `check`. */
  item?: () => unknown
  /** The field's path in the form, handed to validators. */
  path?: () => string
}

interface Cached {
  specs: FormRuleSpec[] | undefined
  required: boolean
  functions: RulesOptions['functions']
  validators: RulesOptions['validators']
  item: RulesOptions['item']
  path: RulesOptions['path']
  rules: FormRule[]
}

const cache = new WeakMap<object, Cached>()

/**
 * The rules of a field node, `required` first. Cached per node while its
 * `rules`, whether it is required and the other options stay the same, so
 * re-renders hand the form item the same array.
 */
export function rulesOf(
  node: FormFieldNode | FormListNode,
  options: RulesOptions = {},
): FormRule[] {
  const required = options.required ?? node.required ?? false
  const { functions, validators, item, path } = options
  const cached = cache.get(node)
  if (
    cached &&
    cached.specs === node.rules &&
    cached.required === required &&
    cached.functions === functions &&
    cached.validators === validators &&
    cached.item === item &&
    cached.path === path
  )
    return cached.rules
  const rules = (node.rules ?? []).map((spec) => toFormRule(spec, options))
  if (required && !rules.some((rule) => rule.required)) rules.unshift({ required: true })
  cache.set(node, { specs: node.rules, required, functions, validators, item, path, rules })
  return rules
}
