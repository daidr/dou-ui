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
export function callAt(formula: string, caret: number): { name: string; arg: number } | null {
  if (!formula.startsWith('=')) return null
  const stack: { name: string | null; arg: number }[] = []
  let last: SheetFormulaToken | undefined
  for (const token of formulaTokens(formula)) {
    if (token.start >= caret) break
    if (token.kind === 'op') {
      if (token.text === '(')
        stack.push({
          name: last?.kind === 'name' && last.end === token.start ? last.text.toUpperCase() : null,
          arg: 0,
        })
      else if (token.text === ')') stack.pop()
      else if ((token.text === ',' || token.text === ';') && stack.length)
        stack[stack.length - 1]!.arg++
    }
    last = token
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    const call = stack[i]!
    if (call.name) return { name: call.name, arg: call.arg }
  }
  return null
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
