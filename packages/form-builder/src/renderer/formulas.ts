import { fieldNodes } from '../core/document'
import { related, tryCompileExpression } from '../core/expression'
import type { CompiledExpression } from '../core/expression'
import type { FormDocument } from '../core/types'

export interface FormulaField {
  name: string
  expression: CompiledExpression
}

/**
 * The fields whose formulas read one another in a circle, each circle as
 * the names on it, e.g. `[['total', 'tax']]`. A formula reading its own
 * field is a circle of one.
 */
export function findFormulaCycles(document: FormDocument): string[][] {
  return analyse(document).cycles
}

/** The formulas of a document that can run: every one that parses and is on no circle. */
export function formulasOf(document: FormDocument): FormulaField[] {
  return analyse(document).formulas
}

function analyse(document: FormDocument) {
  const all: FormulaField[] = []
  for (const node of fieldNodes(document)) {
    if (!node.formula) continue
    const expression = tryCompileExpression(node.formula)
    if (expression) all.push({ name: node.name!, expression })
  }

  // Formula fields reading each other, in Tarjan's way: every strongly
  // connected group of more than one, or one that reads itself, is a circle.
  const reads = all.map(({ name, expression }) =>
    all
      .map((other, index) => ({ other, index }))
      .filter(
        ({ other }) =>
          expression.fields.some((path) => related(other.name, path)) ||
          (other.name === name && expression.readsValue),
      )
      .map(({ index }) => index),
  )
  const order: number[] = Array.from({ length: all.length }, () => -1)
  const low: number[] = []
  const stack: number[] = []
  const onStack = new Set<number>()
  const cycles: string[][] = []
  const onCycle = new Set<number>()
  let counter = 0

  function connect(index: number) {
    order[index] = low[index] = counter++
    stack.push(index)
    onStack.add(index)
    for (const next of reads[index]!) {
      if (order[next] === -1) {
        connect(next)
        low[index] = Math.min(low[index]!, low[next]!)
      } else if (onStack.has(next)) low[index] = Math.min(low[index]!, order[next]!)
    }
    if (low[index] !== order[index]) return
    const group: number[] = []
    let member: number
    do {
      member = stack.pop()!
      onStack.delete(member)
      group.unshift(member)
    } while (member !== index)
    if (group.length > 1 || reads[index]!.includes(index)) {
      group.forEach((i) => onCycle.add(i))
      cycles.push(group.map((i) => all[i]!.name))
    }
  }
  for (let i = 0; i < all.length; i++) if (order[i] === -1) connect(i)

  return { formulas: all.filter((_, index) => !onCycle.has(index)), cycles }
}
