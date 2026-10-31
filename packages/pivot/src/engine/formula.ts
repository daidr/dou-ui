/**
 * Calculated values: a small expression language over the fields, read
 * without `eval`. `profit / amount` divides the sum of `profit` by the sum
 * of `amount` in each cell, so totals are ratios of totals, not sums of ratios.
 *
 * - numbers: `12`, `0.5`, `1e3`
 * - fields: a name (`amount`, `销售额`), or any name in brackets (`[unit price]`)
 * - `+ - * /`, parentheses and a leading minus
 * - `sum(f)`, `avg(f)`, `min(f)`, `max(f)`, `count(f)` (records where f is not empty) and `count()`
 *
 * A bare field name stands for `sum(name)`. Dividing by zero leaves the cell empty.
 */

/** The ways a formula can sum up a field. */
export type PivotFormulaAggregate = 'sum' | 'avg' | 'min' | 'max' | 'count'

/** A field a formula reads, and how. `field` is null for `count()`. */
export interface PivotFormulaTerm {
  aggregate: PivotFormulaAggregate
  field: string | null
}

type Node =
  | { kind: 'number'; value: number }
  | { kind: 'term'; index: number }
  | { kind: 'negate'; operand: Node }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: Node; right: Node }

/** A formula read into its terms and a function of their values. */
export interface PivotFormula {
  source: string
  /** Each distinct field-and-aggregate the formula reads, in the order of `evaluate`'s input. */
  terms: PivotFormulaTerm[]
  /** The formula's value from its terms' values; `NaN` for an empty cell. */
  evaluate(values: ArrayLike<number>): number
}

/** Why a formula could not be read. */
export type PivotFormulaErrorCode =
  | 'empty'
  | 'incomplete'
  | 'unknownChar'
  | 'unexpected'
  | 'expected'
  | 'unclosedBracket'
  | 'emptyName'
  | 'unknownFunction'
  | 'needsField'
  | 'needsName'
  | 'unknownField'
  | 'notNumber'

const MESSAGES: Record<PivotFormulaErrorCode, string> = {
  empty: '公式是空的',
  incomplete: '公式不完整',
  unknownChar: '无法识别“{detail}”',
  unexpected: '这里不应出现“{detail}”',
  expected: '这里应当是“{detail}”',
  unclosedBracket: '缺少“]”',
  emptyName: '方括号里没有字段名',
  unknownFunction: '没有名为“{detail}”的函数',
  needsField: '{detail}() 需要一个字段',
  needsName: '这里应当是字段名',
  unknownField: '没有名为“{detail}”的字段',
  notNumber: '“{detail}”不是数字字段',
}

/**
 * Why a formula could not be read, and where: `at` is a character offset,
 * `detail` the text the message is about. `code` lets a page word it its own way.
 */
export class PivotFormulaError extends Error {
  constructor(
    readonly code: PivotFormulaErrorCode,
    readonly at: number,
    readonly detail = '',
  ) {
    super(`[DouPivot] 计算值：${MESSAGES[code].replace('{detail}', detail)}`)
    this.name = 'PivotFormulaError'
  }
}

const FUNCTIONS = new Set<PivotFormulaAggregate>(['sum', 'avg', 'min', 'max', 'count'])

interface Token {
  type: 'number' | 'name' | 'op' | 'end'
  text: string
  at: number
  /** A name written in brackets, so never a function. */
  quoted?: boolean
}

const NAME_START = /[\p{L}_$]/u
const NAME_PART = /[\p{L}\p{N}_$.]/u

function tokenize(text: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    const at = i
    if (/[0-9.]/.test(ch)) {
      const match = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(i))
      if (!match) throw new PivotFormulaError('unknownChar', at, ch)
      out.push({ type: 'number', text: match[0], at })
      i += match[0].length
    } else if (ch === '[') {
      const end = text.indexOf(']', i + 1)
      if (end < 0) throw new PivotFormulaError('unclosedBracket', at)
      const name = text.slice(i + 1, end).trim()
      if (!name) throw new PivotFormulaError('emptyName', at)
      out.push({ type: 'name', text: name, at, quoted: true })
      i = end + 1
    } else if (NAME_START.test(ch)) {
      let j = i + 1
      while (j < text.length && NAME_PART.test(text[j]!)) j++
      out.push({ type: 'name', text: text.slice(i, j), at })
      i = j
    } else if ('+-*/(),'.includes(ch)) {
      out.push({ type: 'op', text: ch, at })
      i++
    } else {
      throw new PivotFormulaError('unknownChar', at, ch)
    }
  }
  out.push({ type: 'end', text: '', at: text.length })
  return out
}

/**
 * Reads a formula. Throws a `PivotFormulaError` when it is not well formed.
 * Field names are not checked here (see `computePivot`).
 */
export function parseFormula(text: string): PivotFormula {
  const tokens = tokenize(text)
  const terms: PivotFormulaTerm[] = []
  let pos = 0
  const peek = () => tokens[pos]!
  const next = () => tokens[pos++]!
  const expect = (op: string) => {
    const t = next()
    if (t.type !== 'op' || t.text !== op) throw new PivotFormulaError('expected', t.at, op)
  }
  const term = (aggregate: PivotFormulaAggregate, field: string | null): Node => {
    let index = terms.findIndex((t) => t.aggregate === aggregate && t.field === field)
    if (index < 0) index = terms.push({ aggregate, field }) - 1
    return { kind: 'term', index }
  }

  // expression := product (('+' | '-') product)*
  function expression(): Node {
    let left = product()
    for (let t = peek(); t.type === 'op' && (t.text === '+' || t.text === '-'); t = peek()) {
      next()
      left = { kind: 'binary', op: t.text as '+' | '-', left, right: product() }
    }
    return left
  }
  // product := unary (('*' | '/') unary)*
  function product(): Node {
    let left = unary()
    for (let t = peek(); t.type === 'op' && (t.text === '*' || t.text === '/'); t = peek()) {
      next()
      left = { kind: 'binary', op: t.text as '*' | '/', left, right: unary() }
    }
    return left
  }
  function unary(): Node {
    const t = peek()
    if (t.type === 'op' && (t.text === '-' || t.text === '+')) {
      next()
      const operand = unary()
      return t.text === '-' ? { kind: 'negate', operand } : operand
    }
    return primary()
  }
  function primary(): Node {
    const t = next()
    if (t.type === 'number') return { kind: 'number', value: Number(t.text) }
    if (t.type === 'op' && t.text === '(') {
      const inner = expression()
      expect(')')
      return inner
    }
    if (t.type === 'name') {
      const after = peek()
      if (!t.quoted && after.type === 'op' && after.text === '(') {
        const name = t.text.toLowerCase() as PivotFormulaAggregate
        if (!FUNCTIONS.has(name)) throw new PivotFormulaError('unknownFunction', t.at, t.text)
        next()
        const close = peek()
        if (close.type === 'op' && close.text === ')') {
          if (name !== 'count') throw new PivotFormulaError('needsField', close.at, t.text)
          next()
          return term('count', null)
        }
        const arg = next()
        if (arg.type !== 'name') throw new PivotFormulaError('needsName', arg.at)
        expect(')')
        return term(name, arg.text)
      }
      return term('sum', t.text)
    }
    if (t.type === 'end') throw new PivotFormulaError('incomplete', t.at)
    throw new PivotFormulaError('unexpected', t.at, t.text)
  }

  if (peek().type === 'end') throw new PivotFormulaError('empty', 0)
  const root = expression()
  const rest = peek()
  if (rest.type !== 'end') throw new PivotFormulaError('unexpected', rest.at, rest.text)

  const run = (node: Node, values: ArrayLike<number>): number => {
    switch (node.kind) {
      case 'number':
        return node.value
      case 'term':
        return values[node.index]!
      case 'negate':
        return -run(node.operand, values)
      case 'binary': {
        const a = run(node.left, values)
        const b = run(node.right, values)
        switch (node.op) {
          case '+':
            return a + b
          case '-':
            return a - b
          case '*':
            return a * b
          case '/':
            return b === 0 ? Number.NaN : a / b
        }
      }
    }
  }
  return {
    source: text,
    terms,
    evaluate: (values) => {
      const v = run(root, values)
      return Number.isFinite(v) ? v : Number.NaN
    },
  }
}
