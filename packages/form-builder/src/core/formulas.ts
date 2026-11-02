import { cloneValue, getPath, isField, isList, setPath, valueNodes } from './document'
import { equalValues, related, tryCompileExpression } from './expression'
import type { CompiledExpression, FormFunction } from './expression'
import type { FormDocument, FormListNode, FormNode } from './types'

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
  return analyse(document.nodes, 'fields').cycles
}

/** The formulas of a document that can run: every one that parses and is on no circle. */
export function formulasOf(document: FormDocument): FormulaField[] {
  return analyse(document.nodes, 'fields').formulas
}

/** Like `findFormulaCycles`, for the fields of a list's items, which read each other through `item`. */
export function findItemFormulaCycles(list: FormListNode): string[][] {
  return analyse(list.children, 'itemFields').cycles
}

function analyse(nodes: readonly FormNode[], reads: 'fields' | 'itemFields') {
  const all: FormulaField[] = []
  for (const node of valueNodes(nodes)) {
    if (!isField(node) || !node.formula) continue
    const expression = tryCompileExpression(node.formula)
    if (expression) all.push({ name: node.name!, expression })
  }

  // Formula fields reading each other, in Tarjan's way: every strongly
  // connected group of more than one, or one that reads itself, is a circle.
  const edges = all.map(({ name, expression }) =>
    all
      .map((other, index) => ({ other, index }))
      .filter(
        ({ other }) =>
          expression[reads].some((path) => related(other.name, path)) ||
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
    for (const next of edges[index]!) {
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
    if (group.length > 1 || edges[index]!.includes(index)) {
      group.forEach((i) => onCycle.add(i))
      cycles.push(group.map((i) => all[i]!.name))
    }
  }
  for (let i = 0; i < all.length; i++) if (order[i] === -1) connect(i)

  return { formulas: all.filter((_, index) => !onCycle.has(index)), cycles }
}

/**
 * Works out every formula of the form at once, the items' included, and
 * writes the results into `values`, going over them again until nothing
 * changes. The renderer's watchers keep results up to date in the page; on
 * the server, where watchers run only once, this gives the same values the
 * page will have, so a formula reading the items' formulas is not left behind.
 */
export function settleFormulas(
  document: FormDocument,
  values: Record<string, unknown>,
  functions?: Readonly<Record<string, FormFunction>>,
) {
  const top = formulasOf(document)
  // Each pass settles at least one more formula in a chain, so this many always do.
  for (let pass = 0; pass <= top.length; pass++) {
    let changed = settleItems(document.nodes, values, values, functions)
    for (const { name, expression } of top)
      changed =
        write(values, name, expression.evaluate({ values, value: null, functions })) || changed
    if (!changed) return
  }
}

function settleItems(
  nodes: readonly FormNode[],
  target: Record<string, unknown>,
  values: Record<string, unknown>,
  functions: Readonly<Record<string, FormFunction>> | undefined,
) {
  let changed = false
  for (const node of valueNodes(nodes)) {
    if (!isList(node)) continue
    const items = getPath(target, node.name)
    if (!Array.isArray(items)) continue
    const formulas = analyse(node.children, 'itemFields').formulas
    for (const item of items as unknown[]) {
      if (item === null || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      for (let pass = 0; pass <= formulas.length; pass++) {
        let again = settleItems(node.children, row, values, functions)
        for (const { name, expression } of formulas)
          again = write(row, name, expression.evaluate({ values, item: row, functions })) || again
        if (!again) break
        changed = true
      }
    }
  }
  return changed
}

function write(target: Record<string, unknown>, name: string, result: unknown) {
  if (equalValues(result, getPath(target, name))) return false
  setPath(target, name, cloneValue(result))
  return true
}
