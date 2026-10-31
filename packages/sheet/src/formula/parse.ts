import { splitSheet } from '../core/address'
import { ERROR_CODES, type SheetErrorCode } from './error'

/*
 * Formulas as a tree. The text after `=` is read the usual way: numbers,
 * "text" (with "" for a quote), TRUE / FALSE, error values, references
 * (`A1`, `$A$1`, `A1:B9`, `B:D`, `2:3`, `'表 2'!A1`), function calls,
 * and operators by precedence from loosest to tightest: comparison
 * (= <> < > <= >=), & (joining text), + -, * /, ^, % after a value, and a
 * sign before it. A sign binds tighter than ^, so `-2^2` is 4.
 */

export type SheetFormulaNode =
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'error'; code: SheetErrorCode }
  /**
   * A reference, with its sheet as written (unquoted); whole columns run
   * from row 0 to `Infinity`, whole rows likewise. `cell` is a single cell.
   */
  | {
      type: 'ref'
      sheet?: string
      top: number
      left: number
      bottom: number
      right: number
      cell: boolean
    }
  /** A function call; `name` in capitals. */
  | { type: 'call'; name: string; args: SheetFormulaNode[] }
  | { type: 'unary'; op: '-' | '+' | '%'; arg: SheetFormulaNode }
  | { type: 'binary'; op: BinaryOp; left: SheetFormulaNode; right: SheetFormulaNode }
  /** An argument left out, as in `IF(A1,,1)`. */
  | { type: 'empty' }

export type BinaryOp = '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '>' | '<=' | '>='

/** Thrown for text that isn't a formula; it shows as `#ERROR!`. */
export class SheetFormulaSyntaxError extends Error {
  constructor(
    message: string,
    readonly at: number,
  ) {
    super(message)
  }
}

type Token = (
  | { kind: 'number'; value: number }
  | { kind: 'text'; value: string }
  | { kind: 'error'; code: SheetErrorCode }
  | { kind: 'ref'; node: Extract<SheetFormulaNode, { type: 'ref' }> }
  | { kind: 'name'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'end' }
) & { at: number; end: number }

const END = '(?![\\p{L}\\p{N}_(!.])'
const SHEET = "(?:('(?:[^']|'')+'|[\\p{L}_][\\p{L}\\p{N}_.]*)!)?"
const REF = new RegExp(
  SHEET +
    '(?:(\\$?[a-z]{1,3}\\$?[1-9]\\d{0,6})(?::(\\$?[a-z]{1,3}\\$?[1-9]\\d{0,6}))?' +
    '|(\\$?[a-z]{1,3}):(\\$?[a-z]{1,3})' +
    '|(\\$?[1-9]\\d{0,6}):(\\$?[1-9]\\d{0,6}))' +
    END,
  'iuy',
)
const SHEET_ERROR = new RegExp(`${SHEET}#REF!`, 'iuy')
const NUMBER = /(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/iy
const NAME = /[\p{L}_][\p{L}\p{N}_.]*/uy
const NAME_START = /[\p{L}_]/u
const OPS = new Set(['+', '-', '*', '/', '^', '&', '=', '<', '>', '%', '(', ')', ',', ';'])

/** One end of a reference, `$B$3`, `B` or `3`, read by hand: this runs for every reference. */
function readEnd(text: string) {
  let i = text.charCodeAt(0) === 36 ? 1 : 0
  let col = -1
  for (let c = text.charCodeAt(i); (c | 32) >= 97 && (c | 32) <= 122; c = text.charCodeAt(++i))
    col = (col + 1) * 26 + (c | 32) - 97
  if (text.charCodeAt(i) === 36) i++
  const row = i < text.length ? Number(text.slice(i)) - 1 : -1
  return { col: col === -1 ? undefined : col, row: row === -1 ? undefined : row }
}

function readRef(match: RegExpExecArray): Extract<SheetFormulaNode, { type: 'ref' }> {
  const sheet = match[1] ? splitSheet(`${match[1]}!`).sheet : undefined
  const first = match[2] != null ? 0 : match[4] != null ? 2 : 4
  const a = readEnd(match[first + 2]!)
  const to = match[first + 3]
  const b = to != null ? readEnd(to) : a
  const top = Math.min(a.row ?? 0, b.row ?? 0)
  const left = Math.min(a.col ?? 0, b.col ?? 0)
  const bottom = a.row == null ? Infinity : Math.max(a.row, b.row!)
  const right = a.col == null ? Infinity : Math.max(a.col, b.col!)
  const node: Extract<SheetFormulaNode, { type: 'ref' }> = {
    type: 'ref',
    top,
    left,
    bottom,
    right,
    cell: first === 0 && to == null,
  }
  if (sheet != null) node.sheet = sheet
  return node
}

/** Splits a formula into tokens; `loose` reads what isn't a formula yet too, as while typing. */
/** A token before its end is known; per kind, so each keeps its own fields. */
type WithoutEnd<T> = T extends unknown ? Omit<T, 'end'> : never

function tokenize(text: string, loose = false): Token[] {
  const tokens: Token[] = []
  let i = 0
  const push = (token: WithoutEnd<Token>, length: number) => {
    tokens.push({ ...token, end: token.at + length } as Token)
    i = token.at + length
  }
  const at = (re: RegExp) => {
    re.lastIndex = i
    return re.exec(text)
  }
  while (i < text.length) {
    const char = text[i]!
    if (char === ' ' || /\s/.test(char)) {
      i++
      continue
    }
    if (char === '"') {
      let value = ''
      let j = i + 1
      for (; ; j++) {
        if (j >= text.length) {
          if (!loose) throw new SheetFormulaSyntaxError('Text without its closing quote', i)
          break
        }
        if (text[j] === '"') {
          if (text[j + 1] === '"') {
            value += '"'
            j++
          } else break
        } else value += text[j]
      }
      push({ kind: 'text', value, at: i }, Math.min(j + 1, text.length) - i)
      continue
    }
    if (char === '#') {
      const code = ERROR_CODES.find(
        (c) => text.startsWith(c, i) || text.toUpperCase().startsWith(c, i),
      )
      if (code) {
        push({ kind: 'error', code, at: i }, code.length)
        continue
      }
      if (!loose) throw new SheetFormulaSyntaxError('Unknown error value', i)
      push({ kind: 'op', value: char, at: i }, 1)
      continue
    }
    // a reference starts with a letter, `$`, a quote, or a digit for rows (`2:3`)
    const ref = OPS.has(char) ? null : at(REF)
    if (ref) {
      push({ kind: 'ref', node: readRef(ref), at: i }, ref[0].length)
      continue
    }
    const refError = char === "'" || NAME_START.test(char) ? at(SHEET_ERROR) : null
    if (refError) {
      push({ kind: 'error', code: '#REF!', at: i }, refError[0].length)
      continue
    }
    const number = (char >= '0' && char <= '9') || char === '.' ? at(NUMBER) : null
    if (number) {
      push({ kind: 'number', value: Number(number[0]), at: i }, number[0].length)
      continue
    }
    const name = at(NAME)
    if (name) {
      push({ kind: 'name', value: name[0], at: i }, name[0].length)
      continue
    }
    const two = text.slice(i, i + 2)
    const op = two === '<>' || two === '<=' || two === '>=' ? two : OPS.has(char) ? char : undefined
    if (!op && !loose) throw new SheetFormulaSyntaxError(`Unexpected "${char}"`, i)
    push({ kind: 'op', value: op ?? char, at: i }, (op ?? char).length)
  }
  tokens.push({ kind: 'end', at: text.length, end: text.length })
  return tokens
}

/** A piece of a formula as written, with where it is in the text (counting the `=`). */
export type SheetFormulaToken =
  | { kind: 'number' | 'text' | 'name' | 'op' | 'error'; start: number; end: number; text: string }
  | {
      kind: 'ref'
      start: number
      end: number
      text: string
      ref: Extract<SheetFormulaNode, { type: 'ref' }>
    }

/**
 * The pieces of a formula, also one being typed and not finished, e.g. for
 * coloring it: numbers, "text", names (of functions), references,
 * operators and brackets, and error values. Spaces are left out.
 */
export function formulaTokens(formula: string): SheetFormulaToken[] {
  const offset = formula.startsWith('=') ? 1 : 0
  const text = formula.slice(offset)
  const out: SheetFormulaToken[] = []
  for (const token of tokenize(text, true)) {
    if (token.kind === 'end') break
    const start = token.at + offset
    const end = token.end + offset
    const piece = formula.slice(start, end)
    if (token.kind === 'ref') out.push({ kind: 'ref', start, end, text: piece, ref: token.node })
    else out.push({ kind: token.kind, start, end, text: piece })
  }
  return out
}

const BINARY: Record<string, [number, BinaryOp]> = {
  '=': [1, '='],
  '<>': [1, '<>'],
  '<': [1, '<'],
  '>': [1, '>'],
  '<=': [1, '<='],
  '>=': [1, '>='],
  '&': [2, '&'],
  '+': [3, '+'],
  '-': [3, '-'],
  '*': [4, '*'],
  '/': [4, '/'],
  '^': [5, '^'],
}

/**
 * Reads a formula, with or without its `=`, into a tree. Throws
 * `SheetFormulaSyntaxError` for text that isn't one.
 */
export function parseFormula(formula: string): SheetFormulaNode {
  const text = formula.startsWith('=') ? formula.slice(1) : formula
  const tokens = tokenize(text)
  let pos = 0
  const peek = () => tokens[pos]!
  const isOp = (value: string) => {
    const t = peek()
    return t.kind === 'op' && t.value === value
  }
  const expect = (value: string) => {
    if (!isOp(value)) throw new SheetFormulaSyntaxError(`Expected "${value}"`, peek().at)
    pos++
  }

  function expression(min: number): SheetFormulaNode {
    let left = prefix()
    for (;;) {
      const t = peek()
      if (t.kind !== 'op') break
      const binary = BINARY[t.value]
      if (!binary || binary[0] < min) break
      pos++
      // ^ is left to right too, as spreadsheet programs read `2^3^2`
      const right = expression(binary[0] + 1)
      left = { type: 'binary', op: binary[1], left, right }
    }
    return left
  }

  function prefix(): SheetFormulaNode {
    const t = peek()
    if (t.kind === 'op' && (t.value === '-' || t.value === '+')) {
      pos++
      return { type: 'unary', op: t.value, arg: prefix() }
    }
    let node = primary()
    while (isOp('%')) {
      pos++
      node = { type: 'unary', op: '%', arg: node }
    }
    return node
  }

  function primary(): SheetFormulaNode {
    const t = peek()
    pos++
    switch (t.kind) {
      case 'number':
        return { type: 'number', value: t.value }
      case 'text':
        return { type: 'text', value: t.value }
      case 'error':
        return { type: 'error', code: t.code }
      case 'ref':
        return t.node
      case 'name': {
        if (isOp('(')) {
          pos++
          const args: SheetFormulaNode[] = []
          if (isOp(')')) pos++
          else
            for (;;) {
              const n = peek()
              args.push(
                n.kind === 'op' && (n.value === ',' || n.value === ';' || n.value === ')')
                  ? { type: 'empty' }
                  : expression(1),
              )
              if (isOp(',') || isOp(';')) pos++
              else {
                expect(')')
                break
              }
            }
          return { type: 'call', name: t.value.toUpperCase(), args }
        }
        const upper = t.value.toUpperCase()
        if (upper === 'TRUE' || upper === 'FALSE')
          return { type: 'boolean', value: upper === 'TRUE' }
        return { type: 'error', code: '#NAME?' }
      }
      case 'op':
        if (t.value === '(') {
          const inner = expression(1)
          expect(')')
          return inner
        }
        throw new SheetFormulaSyntaxError(`Unexpected "${t.value}"`, t.at)
      default:
        throw new SheetFormulaSyntaxError('The formula ends too soon', t.at)
    }
  }

  if (peek().kind === 'end') throw new SheetFormulaSyntaxError('The formula is empty', 0)
  const node = expression(1)
  if (peek().kind !== 'end') throw new SheetFormulaSyntaxError('Unexpected text', peek().at)
  return node
}

/** Every reference in a formula tree. */
export function referencesOf(
  node: SheetFormulaNode,
  out: Extract<SheetFormulaNode, { type: 'ref' }>[] = [],
) {
  switch (node.type) {
    case 'ref':
      out.push(node)
      break
    case 'call':
      for (const arg of node.args) referencesOf(arg, out)
      break
    case 'unary':
      referencesOf(node.arg, out)
      break
    case 'binary':
      referencesOf(node.left, out)
      referencesOf(node.right, out)
      break
  }
  return out
}

/** The functions a formula calls, in capitals. */
export function functionsOf(node: SheetFormulaNode, out = new Set<string>()) {
  if (node.type === 'call') {
    out.add(node.name)
    for (const arg of node.args) functionsOf(arg, out)
  } else if (node.type === 'unary') functionsOf(node.arg, out)
  else if (node.type === 'binary') {
    functionsOf(node.left, out)
    functionsOf(node.right, out)
  }
  return out
}
