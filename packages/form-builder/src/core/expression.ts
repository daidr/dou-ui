/**
 * A small expression language for form logic: show a field when another
 * has some value, compute a total, check one date against another.
 *
 * Expressions come from stored form data, so they are parsed and run by
 * this module and never handed to `eval` or `new Function`. They can read
 * `values` (the whole form) and `value` (the field's own value), call the
 * built-in functions and the ones the app registers, and nothing else.
 *
 *     values.type == 'laptop' && values.price > 5000
 *     round(values.price * values.count, 2)
 *     values.city in ['sh', 'bj'] ? 'east' : 'other'
 */

export type ExpressionErrorCode =
  | 'unexpected-character'
  | 'unterminated-string'
  | 'unexpected-token'
  | 'unexpected-end'
  | 'unknown-name'
  | 'assignment'
  | 'too-deep'
  | 'too-long'

/** Where and why an expression does not parse. `start` and `end` are offsets into the source. */
export class ExpressionError extends Error {
  readonly code: ExpressionErrorCode
  readonly start: number
  readonly end: number

  constructor(code: ExpressionErrorCode, message: string, start: number, end = start + 1) {
    super(message)
    this.name = 'ExpressionError'
    this.code = code
    this.start = start
    this.end = end
  }
}

/** The syntax tree of an expression. Each node keeps its place in the source. */
export type ExpressionNode =
  | { kind: 'literal'; value: string | number | boolean | null; start: number; end: number }
  | { kind: 'list'; items: ExpressionNode[]; start: number; end: number }
  | { kind: 'name'; name: 'values' | 'value' | 'item'; start: number; end: number }
  | { kind: 'member'; object: ExpressionNode; key: ExpressionNode; start: number; end: number }
  | { kind: 'call'; name: string; args: ExpressionNode[]; start: number; end: number }
  | { kind: 'unary'; operator: '!' | '-'; argument: ExpressionNode; start: number; end: number }
  | {
      kind: 'binary'
      operator: BinaryOperator
      left: ExpressionNode
      right: ExpressionNode
      start: number
      end: number
    }
  | {
      kind: 'condition'
      test: ExpressionNode
      whenTrue: ExpressionNode
      whenFalse: ExpressionNode
      start: number
      end: number
    }

export type BinaryOperator =
  '||' | '&&' | '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | '+' | '-' | '*' | '/' | '%'

/** A function expressions can call. It gets the values of its arguments and should not change them. */
export type FormFunction = (...args: any[]) => unknown

/** What an expression reads when it runs. */
export interface ExpressionScope {
  /** The whole form. Defaults to an empty one. */
  values?: Record<string, unknown>
  /** The value of the field the expression belongs to. */
  value?: unknown
  /** Inside a list, the item the field belongs to. */
  item?: unknown
  /** Functions besides the built-in ones; one of the same name replaces the built-in function. */
  functions?: Readonly<Record<string, FormFunction>>
}

export interface CompiledExpression {
  readonly source: string
  readonly ast: ExpressionNode
  /**
   * The paths under `values` the expression reads, e.g. `['price', 'contact.phone']`.
   * An empty string means it reads a key that is only known when it runs,
   * so it may read anything.
   */
  readonly fields: readonly string[]
  /** The paths under `item` it reads, like `fields` for `values`. */
  readonly itemFields: readonly string[]
  /** Whether it reads `value`. */
  readonly readsValue: boolean
  /** The functions it calls. */
  readonly calls: readonly string[]
  /** Run it. A function that throws makes the result `null`. */
  evaluate: (scope: ExpressionScope) => unknown
}

const MAX_LENGTH = 4000
const MAX_DEPTH = 64

// ---------------------------------------------------------------------------
// Tokens

type Token =
  | { type: 'number'; value: number; start: number; end: number }
  | { type: 'string'; value: string; start: number; end: number }
  | { type: 'name'; value: string; start: number; end: number }
  | { type: 'punct'; value: string; start: number; end: number }
  | { type: 'end'; value: ''; start: number; end: number }

const PUNCTUATION = [
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '(',
  ')',
  '[',
  ']',
  ',',
  '.',
  '?',
  ':',
  '!',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
]

const isDigit = (char: string) => char >= '0' && char <= '9'
const isNameStart = (char: string) => /[A-Za-z_$À-￿]/.test(char)
const isNamePart = (char: string) => isNameStart(char) || isDigit(char)

const ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  v: '\v',
  0: '\0',
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const char = source[i]!
    if (/\s/.test(char)) {
      i++
      continue
    }
    const start = i
    if (isDigit(char) || (char === '.' && isDigit(source[i + 1] ?? ''))) {
      const match = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(i))!
      i += match[0].length
      tokens.push({ type: 'number', value: Number(match[0]), start, end: i })
      continue
    }
    if (char === "'" || char === '"') {
      let value = ''
      i++
      for (;;) {
        if (i >= source.length)
          throw new ExpressionError(
            'unterminated-string',
            'The text is missing its closing quote',
            start,
            i,
          )
        const next = source[i]!
        if (next === char) {
          i++
          break
        }
        if (next === '\\') {
          const escaped = source[i + 1]
          if (escaped === undefined) {
            i++
            continue
          }
          if (escaped === 'u' && /^[\da-fA-F]{4}$/.test(source.slice(i + 2, i + 6))) {
            value += String.fromCharCode(parseInt(source.slice(i + 2, i + 6), 16))
            i += 6
            continue
          }
          value += ESCAPES[escaped] ?? escaped
          i += 2
          continue
        }
        value += next
        i++
      }
      tokens.push({ type: 'string', value, start, end: i })
      continue
    }
    if (isNameStart(char)) {
      while (i < source.length && isNamePart(source[i]!)) i++
      tokens.push({ type: 'name', value: source.slice(start, i), start, end: i })
      continue
    }
    const punct = PUNCTUATION.find((p) => source.startsWith(p, i))
    if (punct) {
      i += punct.length
      tokens.push({ type: 'punct', value: punct, start, end: i })
      continue
    }
    if (char === '=')
      throw new ExpressionError('assignment', 'Use == to compare two values', start, start + 1)
    if (char === '&' || char === '|')
      throw new ExpressionError(
        'unexpected-character',
        `Use ${char}${char} for ${char === '&' ? 'and' : 'or'}`,
        start,
        start + 1,
      )
    throw new ExpressionError(
      'unexpected-character',
      `Unexpected character "${char}"`,
      start,
      start + 1,
    )
  }
  tokens.push({ type: 'end', value: '', start: source.length, end: source.length })
  return tokens
}

// ---------------------------------------------------------------------------
// Parser: precedence climbs from `?:` to member access.

const BINARY_LEVELS: BinaryOperator[][] = [
  ['||'],
  ['&&'],
  ['==', '!='],
  ['<', '<=', '>', '>=', 'in'],
  ['+', '-'],
  ['*', '/', '%'],
]

/** Parse an expression. Throws an `ExpressionError` that says where it went wrong. */
export function parseExpression(source: string): ExpressionNode {
  if (source.length > MAX_LENGTH)
    throw new ExpressionError(
      'too-long',
      `An expression may be at most ${MAX_LENGTH} characters`,
      0,
      source.length,
    )
  const tokens = tokenize(source)
  let index = 0
  let depth = 0

  const peek = () => tokens[index]!
  const next = () => tokens[index++]!
  const isPunct = (value: string) => peek().type === 'punct' && peek().value === value
  const isOperator = (value: string) =>
    value === 'in' ? peek().type === 'name' && peek().value === 'in' : isPunct(value)

  function fail(token: Token): never {
    if (token.type === 'end')
      throw new ExpressionError(
        'unexpected-end',
        'The expression ends too early',
        token.start,
        token.end,
      )
    throw new ExpressionError(
      'unexpected-token',
      `Unexpected "${source.slice(token.start, token.end)}"`,
      token.start,
      token.end,
    )
  }

  function expect(value: string) {
    if (!isPunct(value)) fail(peek())
    return next()
  }

  function enter(token: Token) {
    if (++depth > MAX_DEPTH)
      throw new ExpressionError(
        'too-deep',
        'The expression nests too deeply',
        token.start,
        token.end,
      )
  }

  function condition(): ExpressionNode {
    enter(peek())
    const test = binary(0)
    let result = test
    if (isPunct('?')) {
      next()
      const whenTrue = condition()
      expect(':')
      const whenFalse = condition()
      result = {
        kind: 'condition',
        test,
        whenTrue,
        whenFalse,
        start: test.start,
        end: whenFalse.end,
      }
    }
    depth--
    return result
  }

  function binary(level: number): ExpressionNode {
    if (level === BINARY_LEVELS.length) return unary()
    let left = binary(level + 1)
    for (;;) {
      const operator = BINARY_LEVELS[level]!.find(isOperator)
      if (!operator) return left
      next()
      const right = binary(level + 1)
      left = { kind: 'binary', operator, left, right, start: left.start, end: right.end }
    }
  }

  function unary(): ExpressionNode {
    const token = peek()
    if (token.type === 'punct' && (token.value === '!' || token.value === '-')) {
      next()
      enter(token)
      const argument = unary()
      depth--
      return {
        kind: 'unary',
        operator: token.value,
        argument,
        start: token.start,
        end: argument.end,
      }
    }
    return member()
  }

  function member(): ExpressionNode {
    let node = primary()
    for (;;) {
      if (isPunct('.')) {
        next()
        const token = next()
        if (token.type !== 'name') fail(token)
        node = {
          kind: 'member',
          object: node,
          key: { kind: 'literal', value: token.value, start: token.start, end: token.end },
          start: node.start,
          end: token.end,
        }
      } else if (isPunct('[')) {
        next()
        const key = condition()
        const close = expect(']')
        node = { kind: 'member', object: node, key, start: node.start, end: close.end }
      } else return node
    }
  }

  function list(open: Token): ExpressionNode[] {
    const closing = open.value === '(' ? ')' : ']'
    const items: ExpressionNode[] = []
    if (isPunct(closing)) return items
    for (;;) {
      items.push(condition())
      if (!isPunct(',')) return items
      next()
      if (isPunct(closing)) return items
    }
  }

  function primary(): ExpressionNode {
    const token = next()
    switch (token.type) {
      case 'number':
      case 'string':
        return { kind: 'literal', value: token.value, start: token.start, end: token.end }
      case 'name': {
        const name = token.value
        if (isPunct('(')) {
          const open = next()
          const args = list(open)
          const close = expect(')')
          return { kind: 'call', name, args, start: token.start, end: close.end }
        }
        if (name === 'true' || name === 'false')
          return { kind: 'literal', value: name === 'true', start: token.start, end: token.end }
        if (name === 'null')
          return { kind: 'literal', value: null, start: token.start, end: token.end }
        if (name === 'values' || name === 'value' || name === 'item')
          return { kind: 'name', name, start: token.start, end: token.end }
        throw new ExpressionError(
          'unknown-name',
          `Unknown name "${name}"; read fields with values.${name}, or item.${name} inside a list`,
          token.start,
          token.end,
        )
      }
      case 'punct':
        if (token.value === '(') {
          const inner = condition()
          expect(')')
          return inner
        }
        if (token.value === '[') {
          const items = list(token)
          const close = expect(']')
          return { kind: 'list', items, start: token.start, end: close.end }
        }
        return fail(token)
      default:
        return fail(token)
    }
  }

  const root = condition()
  if (peek().type !== 'end') fail(peek())
  return root
}

// ---------------------------------------------------------------------------
// Values

/** Whether a value counts as true: everything but `false`, `null`, `0`, `NaN`, `''` and `[]`. */
export function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

/** Whether a value is empty: `null`, blank text, `[]` or `{}`. */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object' && !(value instanceof Date)) return Object.keys(value).length === 0
  return false
}

const hasOwn = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key)
const BLOCKED = new Set(['__proto__', 'prototype', 'constructor'])

/** `object[key]`, for the object's own data only; `null` when there is none. */
function read(object: unknown, key: unknown): unknown {
  if (object === null || object === undefined) return null
  if (typeof key === 'number' && !Number.isInteger(key)) return null
  const name = String(key)
  if (BLOCKED.has(name)) return null
  if (typeof object === 'string') {
    if (name === 'length') return object.length
    return /^\d+$/.test(name) ? (object[Number(name)] ?? null) : null
  }
  if (typeof object !== 'object') return null
  // Read before checking, so a reactive object tracks the key even while it is missing.
  const value = (object as Record<string, unknown>)[name]
  if (value === undefined || !hasOwn(object, name)) return null
  return value
}

/** Equal by value: lists and objects compare their items, `null` equals a missing value. */
export function equalValues(a: unknown, b: unknown): boolean {
  if (a === undefined) a = null
  if (b === undefined) b = null
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const other = b as unknown[]
    return a.length === other.length && a.every((item, i) => equalValues(item, other[i]))
  }
  if (a instanceof Date || b instanceof Date)
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  return (
    keysA.length === keysB.length &&
    keysA.every((key) => hasOwn(b, key) && equalValues((a as any)[key], (b as any)[key]))
  )
}

/** A number from a number, numeric text, a boolean or nothing (`0`); `NaN` otherwise. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (value === null || value === undefined) return 0
  if (typeof value === 'boolean') return Number(value)
  if (typeof value === 'string') return value.trim() === '' ? 0 : Number(value)
  return Number.NaN
}

const finite = (value: number) => (Number.isFinite(value) ? value : null)

/**
 * A result of arithmetic, rid of the binary rounding noise that decimals
 * pick up (`0.1 * 3` is `0.3`, not `0.30000000000000004`), or `null`
 * when it is not a finite number.
 */
const tidy = (value: number) => {
  if (!Number.isFinite(value)) return null
  return Number.isInteger(value) ? value : Number(value.toPrecision(15))
}

/** Nothing, or blank text: what an untouched field holds. */
const blank = (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
const text = (value: unknown) => (value === null || value === undefined ? '' : String(value))

/** Text that reads as a number, e.g. what a text input holds. */
const numericText = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))

function compare(a: unknown, b: unknown): number | null {
  if (typeof a === 'number' && numericText(b)) b = Number(b)
  else if (typeof b === 'number' && numericText(a)) a = Number(a)
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a - b) ? null : a - b
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
  return null
}

/**
 * `==` in an expression: equal by value, and a number equals text that
 * reads as the same number, as `<` and `*` read it. A text input holding
 * `3` equals `3`.
 */
function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && numericText(b)) return a === Number(b)
  if (typeof b === 'number' && numericText(a)) return Number(a) === b
  return equalValues(a, b)
}

function contains(collection: unknown, item: unknown): boolean {
  if (Array.isArray(collection)) return collection.some((entry) => same(entry, item))
  if (typeof collection === 'string')
    return item !== null && item !== undefined && collection.includes(text(item))
  if (collection !== null && typeof collection === 'object') {
    const key = text(item)
    return !BLOCKED.has(key) && hasOwn(collection, key)
  }
  return false
}

function arithmetic(operator: BinaryOperator, a: unknown, b: unknown): unknown {
  if (
    operator === '+' &&
    (typeof a === 'string' || typeof b === 'string') &&
    !(blank(a) && blank(b))
  )
    return text(a) + text(b)
  // A formula over fields not filled in yet stays empty instead of showing
  // 0: a product with an unknown factor is unknown, and a sum is only
  // unknown when every term is. One empty term of a sum counts as 0.
  if (operator === '+' || operator === '-' ? blank(a) && blank(b) : blank(a) || blank(b))
    return null
  if (operator === '+') return tidy(toNumber(a) + toNumber(b))
  const x = toNumber(a)
  const y = toNumber(b)
  switch (operator) {
    case '-':
      return tidy(x - y)
    case '*':
      return tidy(x * y)
    case '/':
      return tidy(x / y)
    default:
      return tidy(x % y)
  }
}

// ---------------------------------------------------------------------------
// Built-in functions

const pad = (n: number) => String(n).padStart(2, '0')
const formatDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** A day as a count of days since 1970, read from `YYYY-MM-DD…` text, a `Date` or a timestamp. */
function dayNumber(value: unknown): number | null {
  let date: Date | null = null
  if (value instanceof Date) date = value
  else if (typeof value === 'number') date = new Date(value)
  else if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim())
    if (match) return Date.UTC(+match[1]!, +match[2]! - 1, +match[3]!) / 86_400_000
    return null
  }
  if (!date || Number.isNaN(date.getTime())) return null
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
}

/** The numbers among the arguments, lists flattened one level. */
function numbersOf(args: unknown[]): number[] {
  const result: number[] = []
  let list: unknown[] = args
  if (Array.isArray(args[0]) && args.length === 1) list = args[0]
  // `sum(values.items, 'amount')`: one key of every item of a list.
  else if (Array.isArray(args[0]) && args.length === 2 && typeof args[1] === 'string') {
    const key = args[1]
    list = args[0].map((item) => read(item, key))
  }
  for (const arg of list) {
    if (arg === null || arg === undefined || arg === '') continue
    const number = toNumber(arg)
    if (!Number.isNaN(number)) result.push(number)
  }
  return result
}

/**
 * The functions every expression can call:
 *
 * - `len(x)`: length of text, number of items or of keys; `0` for nothing.
 * - `empty(x)`: whether `x` is `null`, blank text, `[]` or `{}`.
 * - `number(x)`: `x` as a number, or `null` when it is not one.
 * - `sum(list)`, `min(list)`, `max(list)`: over a list, or over the arguments;
 *   `sum(list, 'key')` over one key of every item.
 * - `round(x, digits?)`, `abs(x)`.
 * - `today(offset?)`: today, or `offset` days from today, as `YYYY-MM-DD`.
 * - `days(from, to)`: whole days from one date to the other.
 * - `contains(list or text, x)`: like `x in list`.
 */
export const builtinFunctions: Readonly<Record<string, FormFunction>> = Object.freeze({
  len(value: unknown) {
    if (typeof value === 'string' || Array.isArray(value)) return value.length
    if (value !== null && typeof value === 'object') return Object.keys(value).length
    return 0
  },
  empty: isEmptyValue,
  number(value: unknown) {
    if (value === null || value === undefined || value === '') return null
    return finite(toNumber(value))
  },
  sum: (...args: unknown[]) => tidy(numbersOf(args).reduce((total, n) => total + n, 0)),
  min(...args: unknown[]) {
    const numbers = numbersOf(args)
    return numbers.length ? Math.min(...numbers) : null
  },
  max(...args: unknown[]) {
    const numbers = numbersOf(args)
    return numbers.length ? Math.max(...numbers) : null
  },
  round(value: unknown, digits: unknown = 0) {
    if (blank(value)) return null
    const number = toNumber(value)
    const places = Math.max(0, Math.min(10, Math.trunc(toNumber(digits))))
    if (!Number.isFinite(number)) return null
    const sign = number < 0 ? -1 : 1
    // Shift by exponent text so 1.005 rounds to 1.01 like it reads.
    const shifted = Math.round(Number(`${Math.abs(number)}e${places}`))
    return sign * Number(`${shifted}e-${places}`)
  },
  abs: (value: unknown) => (blank(value) ? null : finite(Math.abs(toNumber(value)))),
  today(offset: unknown = 0) {
    const date = new Date()
    date.setDate(date.getDate() + Math.trunc(toNumber(offset)))
    return formatDay(date)
  },
  days(from: unknown, to: unknown) {
    const a = dayNumber(from)
    const b = dayNumber(to)
    return a === null || b === null ? null : Math.round(b - a)
  },
  contains: (collection: unknown, item: unknown) => contains(collection, item),
})

// ---------------------------------------------------------------------------
// Compiling: the tree becomes nested closures, so running an expression
// walks no tree and allocates little.

type Run = (scope: ExpressionScope) => unknown

class CallError extends Error {}

function compileNode(node: ExpressionNode): Run {
  switch (node.kind) {
    case 'literal': {
      const value = node.value
      return () => value
    }
    case 'list': {
      const items = node.items.map(compileNode)
      return (scope) => items.map((item) => item(scope))
    }
    case 'name':
      if (node.name === 'values') return (scope) => scope.values ?? {}
      if (node.name === 'item') return (scope) => scope.item ?? null
      return (scope) => scope.value ?? null
    case 'member': {
      const object = compileNode(node.object)
      if (node.key.kind === 'literal') {
        const key = node.key.value
        return (scope) => read(object(scope), key)
      }
      const key = compileNode(node.key)
      return (scope) => read(object(scope), key(scope))
    }
    case 'call': {
      const name = node.name
      const args = node.args.map(compileNode)
      return (scope) => {
        const fn =
          (scope.functions && hasOwn(scope.functions, name) && scope.functions[name]) ||
          (hasOwn(builtinFunctions, name) ? builtinFunctions[name] : undefined)
        if (!fn) throw new CallError(`Unknown function "${name}"`)
        const result = fn(...args.map((arg) => arg(scope)))
        return result === undefined ? null : result
      }
    }
    case 'unary': {
      const argument = compileNode(node.argument)
      return node.operator === '!'
        ? (scope) => !truthy(argument(scope))
        : (scope) => finite(-toNumber(argument(scope)))
    }
    case 'condition': {
      const test = compileNode(node.test)
      const whenTrue = compileNode(node.whenTrue)
      const whenFalse = compileNode(node.whenFalse)
      return (scope) => (truthy(test(scope)) ? whenTrue(scope) : whenFalse(scope))
    }
    case 'binary': {
      const left = compileNode(node.left)
      const right = compileNode(node.right)
      switch (node.operator) {
        case '&&':
          return (scope) => {
            const value = left(scope)
            return truthy(value) ? right(scope) : value
          }
        case '||':
          return (scope) => {
            const value = left(scope)
            return truthy(value) ? value : right(scope)
          }
        case '==':
          return (scope) => same(left(scope), right(scope))
        case '!=':
          return (scope) => !same(left(scope), right(scope))
        case '<':
          return (scope) => (compare(left(scope), right(scope)) ?? Number.NaN) < 0
        case '<=':
          return (scope) => (compare(left(scope), right(scope)) ?? Number.NaN) <= 0
        case '>':
          return (scope) => (compare(left(scope), right(scope)) ?? Number.NaN) > 0
        case '>=':
          return (scope) => (compare(left(scope), right(scope)) ?? Number.NaN) >= 0
        case 'in':
          return (scope) => contains(right(scope), left(scope))
        default: {
          const operator = node.operator
          return (scope) => arithmetic(operator, left(scope), right(scope))
        }
      }
    }
  }
}

/**
 * The `values` path a member chain reads, e.g. `contact.phone`, or
 * `undefined` when the chain does not start at `values`. A key computed
 * when it runs stops the path there: `values.rows[i].name` reads `rows`,
 * and `values[key]` reads everything (`''`).
 */
function pathOf(node: ExpressionNode, root: 'values' | 'item' = 'values'): string | undefined {
  const keys: string[] = []
  let current = node
  while (current.kind === 'member') {
    const key = current.key
    if (key.kind === 'literal' && key.value !== null) keys.unshift(String(key.value))
    else keys.length = 0
    current = current.object
  }
  if (current.kind !== 'name' || current.name !== root) return undefined
  return keys.join('.')
}

/** The computed keys along a member chain, e.g. `i` in `values.rows[i]`. */
function computedKeys(node: ExpressionNode): ExpressionNode[] {
  const keys: ExpressionNode[] = []
  for (let current = node; current.kind === 'member'; current = current.object)
    if (current.key.kind !== 'literal') keys.push(current.key)
  return keys
}

/** A path inside another one adds nothing: `a` covers `a.b`; `''` covers all. */
function outermost(paths: Set<string>) {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  const sorted = [...paths].sort()
  if (sorted.includes('')) return ['']
  return sorted.filter(
    (path) => !sorted.some((other) => other !== path && path.startsWith(`${other}.`)),
  )
}

function analyse(root: ExpressionNode) {
  const fields = new Set<string>()
  const itemFields = new Set<string>()
  const calls = new Set<string>()
  let readsValue = false

  function visit(node: ExpressionNode) {
    switch (node.kind) {
      case 'name':
        if (node.name === 'value') readsValue = true
        else if (node.name === 'item') itemFields.add('')
        else fields.add('')
        return
      case 'member': {
        const path = pathOf(node)
        if (path !== undefined) {
          fields.add(path)
          computedKeys(node).forEach(visit)
          return
        }
        const itemPath = pathOf(node, 'item')
        if (itemPath !== undefined) {
          itemFields.add(itemPath)
          computedKeys(node).forEach(visit)
          return
        }
        visit(node.object)
        visit(node.key)
        return
      }
      case 'call':
        calls.add(node.name)
        node.args.forEach(visit)
        return
      case 'list':
        node.items.forEach(visit)
        return
      case 'unary':
        visit(node.argument)
        return
      case 'binary':
        visit(node.left)
        visit(node.right)
        return
      case 'condition':
        visit(node.test)
        visit(node.whenTrue)
        visit(node.whenFalse)
        return
      case 'literal':
    }
  }
  visit(root)
  return {
    fields: outermost(fields),
    itemFields: outermost(itemFields),
    calls: [...calls],
    readsValue,
  }
}

const warned = new Set<string>()
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[@dou-ui/form-builder] ${message}`)
}

const compiled = new Map<string, CompiledExpression | ExpressionError>()
const CACHE_SIZE = 2000

/**
 * Parse an expression once and get a function that runs it. Results are
 * cached by source text, so every field with the same expression shares
 * one. Throws an `ExpressionError` when it does not parse.
 */
export function compileExpression(source: string): CompiledExpression {
  let result = compiled.get(source)
  if (!result) {
    try {
      const ast = parseExpression(source)
      const run = compileNode(ast)
      const { fields, itemFields, calls, readsValue } = analyse(ast)
      result = {
        source,
        ast,
        fields,
        itemFields,
        calls,
        readsValue,
        evaluate(scope) {
          try {
            const value = run(scope)
            return value === undefined ? null : value
          } catch (error) {
            warnOnce(
              `${source}\u0000${(error as Error).message}`,
              `form expression \`${source}\` failed: ${(error as Error).message}; it gives null`,
            )
            return null
          }
        },
      }
    } catch (error) {
      if (!(error instanceof ExpressionError)) throw error
      result = error
    }
    if (compiled.size >= CACHE_SIZE) compiled.clear()
    compiled.set(source, result)
  }
  if (result instanceof ExpressionError) throw result
  return result
}

/**
 * Like `compileExpression`, but warns once and gives `undefined` for an
 * expression that does not parse, for code that renders whatever it is given.
 */
export function tryCompileExpression(source: string): CompiledExpression | undefined {
  try {
    return compileExpression(source)
  } catch (error) {
    const { message, start } = error as ExpressionError
    warnOnce(
      `parse\u0000${source}`,
      `form expression \`${source}\` does not parse: ${message} (at ${start}); it is ignored`,
    )
    return undefined
  }
}

/** Parse and run an expression in one go. */
export function evaluateExpression(source: string, scope: ExpressionScope): unknown {
  return compileExpression(source).evaluate(scope)
}

export interface ExpressionProblem {
  /** What is wrong; an editor shows its own words for each code. */
  code: ExpressionErrorCode | 'unknown-field' | 'unknown-function'
  /** An English description, for logs. */
  message: string
  /** The source text at fault, e.g. the field path or function name, for the editor's message. */
  text: string
  start: number
  end: number
}

/**
 * The problems of an expression, for an editor to point at: a syntax
 * error, or a field or function that does not exist. `fields` are the
 * names of the form's fields; a path inside one (`contact.phone` for a
 * field `contact`) or around one (`contact` for `contact.phone`) counts.
 */
export interface CheckExpressionOptions {
  /** The fields `values` can read; reading another is a problem. */
  fields?: readonly string[]
  /** The fields of a list item that `item` can read; an empty list where there is no item. */
  itemFields?: readonly string[]
  /** Functions besides the built-in ones. */
  functions?: readonly string[]
}

export function checkExpression(
  source: string,
  options: CheckExpressionOptions = {},
): ExpressionProblem[] {
  let ast: ExpressionNode
  try {
    ast = compileExpression(source).ast
  } catch (error) {
    const { code, message, start, end } = error as ExpressionError
    return [{ code, message, text: source.slice(start, end), start, end }]
  }
  const problems: ExpressionProblem[] = []
  const known = options.fields
  const functions = new Set([...Object.keys(builtinFunctions), ...(options.functions ?? [])])

  function visit(node: ExpressionNode) {
    if (node.kind === 'member') {
      const path = pathOf(node)
      if (path !== undefined) {
        if (path !== '' && known && !known.some((name) => related(name, path)))
          problems.push({
            code: 'unknown-field',
            message: `There is no field "${path}"`,
            text: path,
            start: node.start,
            end: node.end,
          })
        computedKeys(node).forEach(visit)
        return
      }
      const itemPath = pathOf(node, 'item')
      if (itemPath !== undefined) {
        const own = options.itemFields
        if (itemPath !== '' && own && !own.some((name) => related(name, itemPath)))
          problems.push({
            code: 'unknown-field',
            message: `There is no field "item.${itemPath}"`,
            text: `item.${itemPath}`,
            start: node.start,
            end: node.end,
          })
        computedKeys(node).forEach(visit)
        return
      }
      visit(node.object)
      visit(node.key)
      return
    }
    if (node.kind === 'call') {
      if (!functions.has(node.name))
        problems.push({
          code: 'unknown-function',
          message: `There is no function "${node.name}"`,
          text: node.name,
          start: node.start,
          end: node.start + node.name.length,
        })
      node.args.forEach(visit)
      return
    }
    if (node.kind === 'name' && node.name === 'item' && options.itemFields?.length === 0)
      problems.push({
        code: 'unknown-field',
        message: 'There is no list item here to read',
        text: 'item',
        start: node.start,
        end: node.end,
      })
    if (node.kind === 'list') node.items.forEach(visit)
    else if (node.kind === 'unary') visit(node.argument)
    else if (node.kind === 'binary') {
      visit(node.left)
      visit(node.right)
    } else if (node.kind === 'condition') {
      visit(node.test)
      visit(node.whenTrue)
      visit(node.whenFalse)
    }
  }
  visit(ast)
  return problems
}

/** Whether a read of `path` can see the field `name`: the same path, or one inside the other. */
export function related(name: string, path: string): boolean {
  return path === '' || name === path || name.startsWith(`${path}.`) || path.startsWith(`${name}.`)
}

/** Today as `YYYY-MM-DD`, in local time. */
export const formatToday = () => formatDay(new Date())
