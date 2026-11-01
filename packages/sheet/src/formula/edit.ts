import type { SheetBounds } from '../core/address'
import { formulaTokens, type SheetFormulaToken } from './parse'

/*
 * What editing a formula needs to know about the text being typed: where
 * its references are, whether a reference can go at the caret, which
 * function call the caret is in, and the name being typed.
 */

/** How many colors references cycle through while a formula is edited. */
export const REF_COLORS = 7

/** A reference in a formula being edited, with the color it is marked in. */
export interface SheetFormulaRefMark {
  start: number
  end: number
  text: string
  /** The sheet it names, as written; `undefined` for the formula's own sheet. */
  sheet?: string
  bounds: SheetBounds
  /** From 0; the same reference written twice has the same color. */
  color: number
}

/** The references of a formula being typed, each with a color. */
export function formulaReferences(formula: string): SheetFormulaRefMark[] {
  if (!formula.startsWith('=')) return []
  const colors = new Map<string, number>()
  const out: SheetFormulaRefMark[] = []
  for (const token of formulaTokens(formula)) {
    if (token.kind !== 'ref') continue
    const { sheet, top, left, bottom, right } = token.ref
    const key = `${sheet?.toLowerCase() ?? ''}!${top}:${left}:${bottom}:${right}`
    let color = colors.get(key)
    if (color == null) colors.set(key, (color = colors.size % REF_COLORS))
    out.push({
      start: token.start,
      end: token.end,
      text: token.text,
      sheet,
      bounds: { top, left, bottom, right },
      color,
    })
  }
  return out
}

/** Operators after which a value comes, so a reference can go there. */
const BEFORE_VALUE = new Set([
  '=',
  '(',
  ',',
  ';',
  '+',
  '-',
  '*',
  '/',
  '^',
  '&',
  '<',
  '>',
  '<=',
  '>=',
  '<>',
])
/** What may follow a value. */
const AFTER_VALUE = new Set([
  ')',
  ',',
  ';',
  '+',
  '-',
  '*',
  '/',
  '^',
  '&',
  '=',
  '<',
  '>',
  '<=',
  '>=',
  '<>',
  '%',
])

/**
 * Whether a reference can be put at the caret of a formula being typed:
 * right after `=`, an operator, `(` or `,`, and before nothing that is a
 * value itself. There, the arrow keys and clicking cells write references.
 */
export function canPointAt(formula: string, caret: number) {
  if (!formula.startsWith('=') || caret < 1) return false
  const tokens = formulaTokens(formula)
  let before: SheetFormulaToken | undefined
  let after: SheetFormulaToken | undefined
  for (const token of tokens) {
    if (token.end <= caret) before = token
    else if (token.start >= caret) {
      after = token
      break
    } else return false // the caret is inside a token
  }
  const fits = !before || (before.kind === 'op' && BEFORE_VALUE.has(before.text))
  const room = !after || (after.kind === 'op' && AFTER_VALUE.has(after.text))
  return fits && room
}

/** The function call the caret is in, innermost first, and which of its arguments, from 0. */
export function callAt(
  formula: string,
  caret: number,
): { name: string; arg: number; count: number } | null {
  if (!formula.startsWith('=')) return null
  const tokens = formulaTokens(formula)
  const stack: { name: string | null; arg: number; open: number }[] = []
  let last: SheetFormulaToken | undefined
  for (const [i, token] of tokens.entries()) {
    if (token.start >= caret) break
    if (token.kind === 'op') {
      if (token.text === '(')
        stack.push({
          name: last?.kind === 'name' && last.end === token.start ? last.text.toUpperCase() : null,
          arg: 0,
          open: i,
        })
      else if (token.text === ')') stack.pop()
      else if ((token.text === ',' || token.text === ';') && stack.length)
        stack[stack.length - 1]!.arg++
    }
    last = token
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    const call = stack[i]!
    if (!call.name) continue
    // all its arguments, also those after the caret, up to its `)`
    let count = 1
    let depth = 0
    for (const token of tokens.slice(call.open + 1)) {
      if (token.kind !== 'op') continue
      if (token.text === '(') depth++
      else if (token.text === ')') {
        if (!depth--) break
      } else if ((token.text === ',' || token.text === ';') && !depth) count++
    }
    return { name: call.name, arg: call.arg, count }
  }
  return null
}

/** The number an argument's name ends with, such as `2` of `[值2`. */
const numberOf = (name: string) => /(\d+)\]?$/.exec(name.replace(/^\[/, ''))?.[1]

/**
 * Which of a function's argument names the argument at `index` (of `count`)
 * is, or -1. After `…` the names before it repeat as a group, such as the
 * pairs of `SUMIFS` or `SWITCH`, numbered alike (`区域1, 条件1`); names after
 * `…`, such as `SWITCH`'s default, are the last arguments when the pairs come out even.
 */
export function argNameAt(args: string[], index: number, count: number): number {
  const more = args.indexOf('…')
  if (more === -1) return index < args.length ? index : -1
  if (index < more) return index
  const last = numberOf(args[more - 1] ?? '')
  let group = 1
  if (last != null) while (group < more && numberOf(args[more - 1 - group]!) === last) group++
  const tail = args.length - more - 1
  if (tail && count - tail >= more && (count - tail - more) % group === 0) {
    const fromEnd = count - index
    if (fromEnd <= tail) return args.length - fromEnd
  }
  const start = more - group
  return start + ((index - start) % group)
}

/**
 * The name being typed at the caret, to complete as a function: letters
 * ending at the caret, not yet followed by `(`.
 */
export function nameAt(
  formula: string,
  caret: number,
): { start: number; end: number; text: string } | null {
  if (!formula.startsWith('=')) return null
  const tokens = formulaTokens(formula)
  for (const [i, token] of tokens.entries()) {
    if (token.end !== caret) continue
    // a cell name such as `A1` or `SUM1` reads as a reference while typing; complete its letters too
    const text =
      token.kind === 'ref' && /^[a-z]+\d*$/i.test(token.text)
        ? token.text
        : token.kind === 'name'
          ? token.text
          : null
    if (!text || !/^[\p{L}_]/u.test(text)) return null
    const next = tokens[i + 1]
    if (next && next.start === token.end && next.text === '(') return null
    return { start: token.start, end: token.end, text }
  }
  return null
}

/** A piece of a formula being typed, as it is colored in the edit box and the formula bar. */
export interface SheetFormulaPart {
  text: string
  /** The reference's color, as in `SheetFormulaRefMark`. */
  color?: number
  /** The syntax color (`dou-syntax-…`) of what isn't a reference. */
  syntax?:
    | 'function'
    | 'string'
    | 'number'
    | 'invalid'
    | 'keyword'
    | 'variable'
    | 'operator'
    | 'punctuation'
}

/**
 * A formula cut into its colored pieces: references in their colors, and
 * function names, "text", numbers, error values and operators in the
 * syntax colors of `@dou-ui/code`, so the cell and either formula bar color
 * it alike. Ends with a zero-width space, so a last line break still takes
 * a line.
 */
export function formulaParts(
  formula: string,
  marks: readonly SheetFormulaRefMark[] = formulaReferences(formula),
): SheetFormulaPart[] {
  const parts: SheetFormulaPart[] = []
  if (!formula.startsWith('=')) return [{ text: `${formula}​` }]
  const colors = new Map(marks.map((mark) => [mark.start, mark.color]))
  const tokens = formulaTokens(formula)
  parts.push({ text: '=', syntax: 'operator' })
  let at = 1
  for (const [i, token] of tokens.entries()) {
    if (token.start > at) parts.push({ text: formula.slice(at, token.start) })
    const part: SheetFormulaPart = { text: token.text }
    if (token.kind === 'ref') {
      const color = colors.get(token.start)
      if (color == null) part.syntax = 'variable'
      else part.color = color
    } else if (token.kind === 'number') part.syntax = 'number'
    else if (token.kind === 'text') part.syntax = 'string'
    else if (token.kind === 'error') part.syntax = 'invalid'
    else if (token.kind === 'name')
      part.syntax =
        tokens[i + 1]?.text === '('
          ? 'function'
          : /^(?:TRUE|FALSE)$/i.test(token.text)
            ? 'keyword'
            : 'variable'
    else part.syntax = /^[(),;{}]$/.test(token.text) ? 'punctuation' : 'operator'
    parts.push(part)
    at = token.end
  }
  parts.push({ text: `${formula.slice(at)}​` })
  return parts
}

/** The class a piece of `formulaParts` is shown with. */
export function partClass(part: SheetFormulaPart): string | undefined {
  if (part.color != null) return `is-ref-${part.color}`
  return part.syntax && `dou-syntax-${part.syntax}`
}
