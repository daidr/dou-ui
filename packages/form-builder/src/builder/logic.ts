import { isContainer, isField, isList } from '../core/document'
import type {
  FormDocument,
  FormFieldNode,
  FormListNode,
  FormNode,
  FormRuleSpec,
} from '../core/types'
import { normalizeOptions } from '../fields/components'
import type { FormFieldType } from '../fields/define'
import type { ConditionLiteral, ConditionOperator } from './condition'
import { scopeOf } from './core/commands'
import { formNodePlaces } from './core/transaction'
import type { FormBuilderMessages } from './locale'
import {
  choices,
  CONDITION_TYPE,
  EXPRESSION_TYPE,
  field,
  nodeTitle,
  number,
  text,
} from './settings'

/** What a value is like, for the operators and the value input a condition row offers. */
export type TargetKind = 'text' | 'number' | 'date' | 'boolean' | 'choice' | 'choices' | 'list'

/** A field a condition or an expression can read. */
export interface LogicTarget {
  scope: 'values' | 'item'
  path: string
  label: string
  kind: TargetKind
  /** The field's own options, for `choice` and `choices`. */
  options?: { label: string; value: ConditionLiteral }[]
}

export const operatorsOf: Record<TargetKind, ConditionOperator[]> = {
  text: ['eq', 'ne', 'contains', 'empty', 'filled'],
  number: ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'empty', 'filled'],
  date: ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'empty', 'filled'],
  boolean: ['eq', 'ne'],
  choice: ['eq', 'ne', 'in', 'empty', 'filled'],
  choices: ['contains', 'empty', 'filled'],
  list: ['empty', 'filled'],
}

const KINDS: Record<string, TargetKind> = {
  switch: 'boolean',
  checkbox: 'boolean',
  'input-number': 'number',
  rate: 'number',
  'date-picker': 'date',
  'time-picker': 'date',
  'radio-group': 'choice',
  'segmented-control': 'choice',
  'checkbox-group': 'choices',
  'input-tag': 'choices',
  upload: 'list',
}

function kindOf(node: FormFieldNode, type: FormFieldType | undefined): TargetKind {
  const props = node.props ?? {}
  const own = KINDS[node.type]
  if (own === 'date' || own === 'number') return props.range ? 'list' : own
  if (own) return own
  if (node.type === 'slider') return props.range ? 'list' : 'number'
  if (type?.optionsProp) return props.multiple ? 'choices' : 'choice'
  const empty = type?.empty?.({ ...type.defaultProps, ...props } as never)
  if (typeof empty === 'boolean') return 'boolean'
  if (typeof empty === 'number') return 'number'
  if (Array.isArray(empty)) return 'choices'
  return 'text'
}

function optionsOf(node: FormFieldNode, type: FormFieldType | undefined) {
  const prop = type?.optionsProp
  const list = prop ? (node.props?.[prop] ?? type?.defaultProps?.[prop]) : undefined
  if (!Array.isArray(list)) return undefined
  return normalizeOptions(list)
    .filter(({ value }) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
    .map(({ label, value }) => ({
      label: String(label ?? value),
      value: value as ConditionLiteral,
    }))
}

/**
 * The target of one field, kept per node: a change to one field of a large
 * form makes a new object only for that field, so scopes built before and
 * after can be told apart without comparing their contents.
 */
const targetCache = new WeakMap<
  FormNode,
  {
    scope: string
    fields: ReadonlyMap<string, FormFieldType>
    messages: FormBuilderMessages
    target: LogicTarget | null
  }
>()
function fieldTarget(
  node: FormFieldNode,
  scope: 'values' | 'item',
  fields: ReadonlyMap<string, FormFieldType>,
  messages: FormBuilderMessages,
): LogicTarget | null {
  const cached = targetCache.get(node)
  if (cached && cached.scope === scope && cached.fields === fields && cached.messages === messages)
    return cached.target
  const type = fields.get(node.type)
  let target: LogicTarget | null = null
  if (type?.kind !== 'display') {
    const kind = kindOf(node, type)
    target = { scope, path: node.name!, label: nodeTitle(node, fields, messages), kind }
    if (kind === 'choice' || kind === 'choices') target.options = optionsOf(node, type)
  }
  targetCache.set(node, { scope, fields, messages, target })
  return target
}

/** The value nodes of one scope, groups and pages included, lists as one value. */
function scopeTargets(
  nodes: readonly FormNode[],
  scope: 'values' | 'item',
  fields: ReadonlyMap<string, FormFieldType>,
  messages: FormBuilderMessages,
  out: LogicTarget[],
) {
  for (const node of nodes) {
    if (isList(node)) {
      if (node.name)
        out.push({ scope, path: node.name, label: nodeTitle(node, fields, messages), kind: 'list' })
      continue
    }
    if (isContainer(node)) {
      scopeTargets(node.children, scope, fields, messages, out)
      continue
    }
    if (!isField(node) || !node.name) continue
    const target = fieldTarget(node, scope, fields, messages)
    if (target) out.push(target)
  }
  return out
}

/** What the logic of a node can read: the form's fields, and those of the list item around it. */
export interface LogicScope {
  targets: LogicTarget[]
  /** The names `values` can read. */
  names: string[]
  /** The names `item` can read; `undefined` outside lists. */
  itemNames: string[] | undefined
}

export function logicScope(
  document: FormDocument,
  id: string | undefined,
  fields: ReadonlyMap<string, FormFieldType>,
  messages: FormBuilderMessages,
): LogicScope {
  const targets = scopeTargets(document.nodes, 'values', fields, messages, [])
  const parent = id ? formNodePlaces(document).get(id)?.parent : undefined
  const list = scopeOf(document, parent?.id ?? null)
  const paths = targets.map((target) => target.path)
  if (!list) return { targets, names: paths, itemNames: undefined }
  const items = scopeTargets(list.children, 'item', fields, messages, [])
  return { targets: [...items, ...targets], names: paths, itemNames: items.map((t) => t.path) }
}

/** Whether two scopes hold the same targets, so settings forms built on the first are kept. */
export function sameLogicScope(a: LogicScope, b: LogicScope): boolean {
  return (
    a.targets.length === b.targets.length &&
    a.targets.every((target, index) => {
      const other = b.targets[index]!
      return target === other || JSON.stringify(target) === JSON.stringify(other)
    })
  )
}

// Settings of logic and checks -----------------------------------------------------

export interface LogicSettingsContext {
  messages: FormBuilderMessages
  /** What the node's expressions can read. */
  scope: LogicScope
  /** The node's type, for a field. */
  type?: FormFieldType
}

/** When a node shows, is disabled or required, and the value a field works out. */
export function logicSettings(node: FormNode, context: LogicSettingsContext): FormNode[] {
  const s = context.messages.settings as Record<string, string>
  // A node's conditions do not read the node itself.
  const own = 'name' in node ? node.name : undefined
  const ownScope = context.scope.itemNames ? 'item' : 'values'
  const targets = context.scope.targets.filter(
    (target) => target.path !== own || target.scope !== ownScope,
  )
  const condition = (name: string) =>
    field(CONDITION_TYPE, name, s[name]!, { help: s[`${name}Help`], props: { targets } })
  const result = [condition('visibleWhen')]
  const display = context.type?.kind === 'display'
  if (!display) result.push(condition('disabledWhen'))
  if (isFieldNode(node) && !display) {
    result.push(condition('requiredWhen'))
    if (node.type !== 'upload')
      result.push(
        field(EXPRESSION_TYPE, 'formula', s.formula!, {
          help: s.formulaHelp,
          props: {
            names: names(context.scope.targets, 'values'),
            itemNames: context.scope.itemNames && names(context.scope.targets, 'item'),
            placeholder: 'values.price * values.count',
          },
        }),
      )
  }
  return result
}

const isFieldNode = (node: FormNode): node is FormFieldNode =>
  !['section', 'tabs', 'steps', 'page', 'list'].includes(node.type)

function names(targets: LogicSettingsContext['scope']['targets'], scope: 'values' | 'item') {
  return targets
    .filter((target) => target.scope === scope)
    .map((target) => ({ path: target.path, label: target.label }))
}

/** The kinds of check the rules editor offers, each writing its own keys of a rule. */
export const ruleKinds = ['type', 'range', 'pattern', 'check'] as const
export type RuleKind = (typeof ruleKinds)[number]

/** The checks of a field or a list, as a list of rules. */
export function ruleSettings(context: LogicSettingsContext): FormNode[] {
  const messages = context.messages
  const s = messages.settings as Record<string, string>
  const list: FormListNode = {
    id: 'setting-rules',
    type: 'list',
    name: 'rules',
    addText: s.addRule,
    columns: 12,
    children: [
      field('select', 'kind', s.ruleKind!, {
        default: 'type',
        props: { options: choices(messages, 'ruleKind', ruleKinds) },
      }),
      field('select', 'type', s.ruleType!, {
        default: 'email',
        visibleWhen: when('type'),
        props: {
          options: choices(messages, 'ruleType', ['email', 'url', 'number', 'integer', 'string']),
        },
      }),
      number('min', s.ruleMin!, {}, { span: 6, visibleWhen: when('range') }),
      number('max', s.ruleMax!, {}, { span: 6, visibleWhen: when('range') }),
      {
        id: 'setting-rangeHelp',
        type: 'text',
        visibleWhen: when('range'),
        props: { content: s.ruleRangeHelp, variant: 'caption' },
      } as FormFieldNode,
      text('pattern', s.rulePattern!, {
        span: 8,
        visibleWhen: when('pattern'),
        props: { placeholder: '^\\d{6}$' },
      }),
      text('flags', s.ruleFlags!, {
        span: 4,
        visibleWhen: when('pattern'),
        props: { placeholder: 'i' },
      }),
      field(EXPRESSION_TYPE, 'check', s.ruleCheck!, {
        help: s.ruleCheckHelp,
        visibleWhen: when('check'),
        props: {
          names: names(context.scope.targets, 'values'),
          itemNames: context.scope.itemNames && names(context.scope.targets, 'item'),
          readsValue: true,
          placeholder: 'value >= values.start',
        },
      }),
      text('message', s.ruleMessage!),
      field('select', 'trigger', s.ruleTrigger!, {
        default: 'auto',
        props: { options: choices(messages, 'ruleTrigger', ['auto', 'change', 'blur']) },
      }),
    ],
  }
  return [list]
}

const when = (kind: RuleKind) => `item.kind == '${kind}'`

type RuleItem = Record<string, unknown> & { kind?: RuleKind }

/** A rule as a row of the rules editor: its keys, and which kind of check it is. */
export function ruleToItem(rule: FormRuleSpec): RuleItem {
  const kind: RuleKind =
    rule.check !== undefined
      ? 'check'
      : rule.pattern !== undefined
        ? 'pattern'
        : rule.type !== undefined
          ? 'type'
          : rule.min !== undefined || rule.max !== undefined
            ? 'range'
            : 'type'
  return { ...rule, kind }
}

const KIND_KEYS: Record<RuleKind, (keyof FormRuleSpec)[]> = {
  type: ['type'],
  range: ['min', 'max'],
  pattern: ['pattern', 'flags'],
  check: ['check'],
}

/** A row of the rules editor as a rule: only the keys of its kind, and the message and trigger. */
export function itemToRule(item: RuleItem): FormRuleSpec {
  const kind = item.kind ?? 'type'
  const rule: Record<string, unknown> = {}
  for (const key of [...KIND_KEYS[kind], 'message', 'trigger'] as const) {
    const value = item[key]
    if (value === undefined || value === null || value === '') continue
    if (key === 'trigger' && value === 'auto') continue
    rule[key] = value
  }
  if (kind === 'type' && rule.type === undefined) rule.type = 'email'
  return rule as FormRuleSpec
}
