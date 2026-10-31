import type { FormRule } from 'dou-ui'
import type { FormFieldNode, FormRuleSpec } from './types'

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

/** One rule as data, as the form's own rule. */
export function toFormRule(spec: FormRuleSpec): FormRule {
  const { pattern, flags, ...rest } = spec
  const rule: FormRule = rest
  if (pattern !== undefined) {
    const compiled = compile(pattern, flags)
    if (compiled) rule.pattern = compiled
  }
  return rule
}

interface Cached {
  specs: FormRuleSpec[] | undefined
  required: boolean | undefined
  rules: FormRule[]
}

const cache = new WeakMap<FormFieldNode, Cached>()

/**
 * The rules of a field node, `required` first. Cached per node while its
 * `rules` and `required` stay the same, so re-renders hand the form item
 * the same array.
 */
export function rulesOf(node: FormFieldNode): FormRule[] {
  const cached = cache.get(node)
  if (cached && cached.specs === node.rules && cached.required === node.required)
    return cached.rules
  const rules = (node.rules ?? []).map(toFormRule)
  if (node.required && !rules.some((rule) => rule.required)) rules.unshift({ required: true })
  cache.set(node, { specs: node.rules, required: node.required, rules })
  return rules
}
