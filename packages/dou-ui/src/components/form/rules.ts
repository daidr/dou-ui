import type { LocaleMessagePath, TranslateParams } from '../config-provider/use-config'
import type { FormModel, FormRule, FormRuleItem, FormTrigger } from './form'
import { isStandardSchema, schemaIssues } from './standard-schema'

type Translate = (path: LocaleMessagePath, params?: TranslateParams) => string

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_LIKE = /^[a-z][\d+.a-z-]*:\/\/\S+$/i

export function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/** Turn a bare schema into `{ schema }`, so the rest only deals with rules. */
export function toRules(value: FormRuleItem | FormRuleItem[] | undefined): FormRule[] {
  return toArray(value).map((rule) => (isStandardSchema(rule) ? { schema: rule } : rule))
}

/** `undefined`, `null`, blank text, an empty list and `false` count as empty. */
export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

export function getPath(model: FormModel | undefined, path: string): unknown {
  let value: unknown = model
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

export function setPath(model: FormModel | undefined, path: string, value: unknown) {
  if (!model) return
  const keys = path.split('.')
  const last = keys.pop()!
  let target: Record<string, unknown> = model
  for (const key of keys) {
    const next = target[key]
    if (next === null || typeof next !== 'object') return
    target = next as Record<string, unknown>
  }
  target[last] = value
}

function matchesType(value: unknown, type: NonNullable<FormRule['type']>): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value)
    case 'integer':
      return Number.isInteger(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
    case 'email':
      return typeof value === 'string' && EMAIL.test(value)
    case 'url':
      return typeof value === 'string' && URL_LIKE.test(value)
  }
}

function typeMessage(type: NonNullable<FormRule['type']>): LocaleMessagePath {
  return type === 'email' || type === 'url' ? `form.${type}` : 'form.invalid'
}

function checkRange(rule: FormRule, value: unknown, t: Translate): string | null {
  const { min, max } = rule
  if (min === undefined && max === undefined) return null
  let size: number
  let kind: 'Length' | 'Items' | ''
  if (typeof value === 'string') [size, kind] = [[...value].length, 'Length']
  else if (Array.isArray(value)) [size, kind] = [value.length, 'Items']
  else if (typeof value === 'number') [size, kind] = [value, '']
  else return null
  if (min !== undefined && size < min)
    return rule.message ?? t(kind ? `form.min${kind}` : 'form.min', { min })
  if (max !== undefined && size > max)
    return rule.message ?? t(kind ? `form.max${kind}` : 'form.max', { max })
  return null
}

async function checkRule(
  rule: FormRule,
  value: unknown,
  model: FormModel,
  t: Translate,
): Promise<string | null> {
  const empty = isEmpty(value)
  if (rule.required && empty) return rule.message ?? t('form.required')

  // Built-in checks only look at values that are present, so an optional
  // field may stay empty.
  if (!empty) {
    if (rule.type && !matchesType(value, rule.type))
      return rule.message ?? t(typeMessage(rule.type))
    const range = checkRange(rule, value, t)
    if (range) return range
    if (rule.pattern && typeof value === 'string') {
      rule.pattern.lastIndex = 0
      if (!rule.pattern.test(value)) return rule.message ?? t('form.pattern')
    }
  }

  if (rule.schema) {
    try {
      const [issue] = await schemaIssues(rule.schema, value)
      if (issue) return rule.message ?? issue.message
    } catch (error) {
      return (error instanceof Error && error.message) || rule.message || t('form.invalid')
    }
  }

  if (rule.validator) {
    try {
      const result = await rule.validator(value, model)
      if (typeof result === 'string') return result
      if (result === false) return rule.message ?? t('form.invalid')
    } catch (error) {
      return (error instanceof Error && error.message) || rule.message || t('form.invalid')
    }
  }
  return null
}

/** Check rules in order and return the first failing message, or `null`. */
export async function validateValue(
  value: unknown,
  rules: FormRule[],
  model: FormModel,
  t: Translate,
): Promise<string | null> {
  for (const rule of rules) {
    const message = await checkRule(rule, value, model, t)
    if (message !== null) return message
  }
  return null
}

/**
 * Pick the rules an event should run.
 *
 * A rule with a `trigger` runs on exactly those events. A rule without one
 * runs on blur and on change, except that a lazy change (typing in text)
 * only runs it while the field already shows an error: the field is not
 * judged while the user is still typing, but is cleared as soon as it is
 * fixed.
 */
export function rulesFor(
  rules: FormRule[],
  event: FormTrigger,
  lazy: boolean,
  hasError: boolean,
): FormRule[] {
  return rules.filter((rule) => {
    if (rule.trigger !== undefined) return toArray(rule.trigger).includes(event)
    return !(lazy && !hasError)
  })
}
