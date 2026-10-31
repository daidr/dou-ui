import { parseExpression } from '../core/expression'
import type { ExpressionNode } from '../core/expression'

/**
 * Conditions as the condition editor shows them: rows of "field, how,
 * value", all of which must hold (`and`) or one of which (`or`). They are
 * written to the node as expression text, and read back from it when the
 * text has that shape; other expressions are edited as text.
 */
export type ConditionOperator =
  'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le' | 'in' | 'contains' | 'empty' | 'filled'

export type ConditionLiteral = string | number | boolean | null

export interface ConditionRow {
  /** What the row reads: the form's values, or the list item around the node. */
  scope: 'values' | 'item'
  /** The path read, e.g. `contact.phone`; empty while no field is picked. */
  path: string
  op: ConditionOperator
  /** A literal, or a list of them for `in`. Unused by `empty` and `filled`. */
  value?: ConditionLiteral | ConditionLiteral[]
}

export interface Condition {
  join: 'and' | 'or'
  rows: ConditionRow[]
}

const COMPARE: Partial<Record<string, ConditionOperator>> = {
  '==': 'eq',
  '!=': 'ne',
  '>': 'gt',
  '>=': 'ge',
  '<': 'lt',
  '<=': 'le',
}
const SYMBOL: Record<string, string> = { eq: '==', ne: '!=', gt: '>', ge: '>=', lt: '<', le: '<=' }

/** Operators that need no value. */
export const unaryOperators: ReadonlySet<ConditionOperator> = new Set(['empty', 'filled'])

const IDENTIFIER = /^[A-Za-z_$À-￿][\w$À-￿]*$/

/** A literal as expression text. */
export function literalSource(value: ConditionLiteral): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  return String(value)
}

/** `values.contact.phone`, with brackets for keys that are not plain names. */
export function referenceSource(scope: 'values' | 'item', path: string): string {
  let text = scope
  for (const key of path.split('.'))
    text += IDENTIFIER.test(key) ? `.${key}` : `[${literalSource(key)}]`
  return text
}

/** Whether a row says enough to be written. */
export function rowComplete(entry: ConditionRow): boolean {
  if (!entry.path) return false
  if (unaryOperators.has(entry.op)) return true
  if (entry.op === 'in') return Array.isArray(entry.value) && entry.value.length > 0
  return entry.value !== undefined && entry.value !== '' && !Array.isArray(entry.value)
}

function rowSource(entry: ConditionRow): string {
  const ref = referenceSource(entry.scope, entry.path)
  switch (entry.op) {
    case 'empty':
      return `empty(${ref})`
    case 'filled':
      return `!empty(${ref})`
    case 'in':
      return `${ref} in [${(entry.value as ConditionLiteral[]).map(literalSource).join(', ')}]`
    case 'contains':
      return `contains(${ref}, ${literalSource(entry.value as ConditionLiteral)})`
    default:
      return `${ref} ${SYMBOL[entry.op]} ${literalSource(entry.value as ConditionLiteral)}`
  }
}

/** The condition as expression text, leaving out rows that are not filled in; `''` for none. */
export function printCondition(condition: Condition): string {
  return condition.rows
    .filter(rowComplete)
    .map(rowSource)
    .join(condition.join === 'and' ? ' && ' : ' || ')
}

/** The path a member chain reads under `values` or `item`, if its keys are all literals. */
function reference(node: ExpressionNode): { scope: 'values' | 'item'; path: string } | undefined {
  const keys: string[] = []
  let current = node
  while (current.kind === 'member') {
    const key = current.key
    if (key.kind !== 'literal' || (typeof key.value !== 'string' && typeof key.value !== 'number'))
      return undefined
    keys.unshift(String(key.value))
    current = current.object
  }
  if (current.kind !== 'name' || current.name === 'value' || !keys.length) return undefined
  return { scope: current.name, path: keys.join('.') }
}

function literal(node: ExpressionNode): ConditionLiteral | undefined {
  if (node.kind === 'literal') return node.value
  // A negative number is `-` applied to a number.
  if (
    node.kind === 'unary' &&
    node.operator === '-' &&
    node.argument.kind === 'literal' &&
    typeof node.argument.value === 'number'
  )
    return -node.argument.value
  return undefined
}

function rowOf(node: ExpressionNode): ConditionRow | undefined {
  if (node.kind === 'call' && node.args.length >= 1) {
    const ref = reference(node.args[0]!)
    if (!ref) return undefined
    if (node.name === 'empty' && node.args.length === 1) return { ...ref, op: 'empty' }
    if (node.name === 'contains' && node.args.length === 2) {
      const value = literal(node.args[1]!)
      return value === undefined ? undefined : { ...ref, op: 'contains', value }
    }
    return undefined
  }
  if (node.kind === 'unary' && node.operator === '!') {
    const inner = rowOf(node.argument)
    return inner?.op === 'empty' ? { ...inner, op: 'filled' } : undefined
  }
  if (node.kind !== 'binary') return undefined
  const ref = reference(node.left)
  if (!ref) return undefined
  if (node.operator === 'in') {
    if (node.right.kind !== 'list') return undefined
    const values = node.right.items.map(literal)
    if (values.some((value) => value === undefined)) return undefined
    return { ...ref, op: 'in', value: values as ConditionLiteral[] }
  }
  const op = COMPARE[node.operator]
  const value = literal(node.right)
  return op && value !== undefined ? { ...ref, op, value } : undefined
}

/** The leaves of a chain of one operator, left to right. */
function chain(node: ExpressionNode, operator: '&&' | '||', out: ExpressionNode[]) {
  if (node.kind === 'binary' && node.operator === operator) {
    chain(node.left, operator, out)
    chain(node.right, operator, out)
  } else out.push(node)
  return out
}

/**
 * The condition an expression says, when it is rows joined by one of
 * `&&` and `||`; `undefined` for any other expression, or one that does
 * not parse. Empty text is a condition without rows.
 */
export function parseCondition(source: string | undefined): Condition | undefined {
  if (!source?.trim()) return { join: 'and', rows: [] }
  let ast: ExpressionNode
  try {
    ast = parseExpression(source)
  } catch {
    return undefined
  }
  const join = ast.kind === 'binary' && ast.operator === '||' ? 'or' : 'and'
  const leaves = chain(ast, join === 'and' ? '&&' : '||', [])
  const rows: ConditionRow[] = []
  for (const leaf of leaves) {
    const each = rowOf(leaf)
    if (!each) return undefined
    rows.push(each)
  }
  return { join, rows }
}
