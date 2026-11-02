import { cloneValue, getPath, isField, isList, setPath, valueNodes } from './document'
import { computedKeys, equalValues, pathOf, related, tryCompileExpression } from './expression'
import type { CompiledExpression, ExpressionNode, FormFunction } from './expression'
import type { FormDocument, FormFieldNode, FormListNode, FormNode } from './types'

export interface FormulaField {
  name: string
  expression: CompiledExpression
}

/** A formula field and where it is: the document's, or the items' of a list. */
interface Formula extends FormulaField {
  node: FormFieldNode
  /** The name shown for it, e.g. `total`, or `rows.total` for the items' field. */
  label: string
}

/** The formulas of the document, or of a list's items, and the lists among them. */
interface Scope {
  formulas: Formula[]
  lists: { node: FormListNode; scope: Scope }[]
}

/** Every formula of a document, worked out once. */
export interface FormulaAnalysis {
  /** The document's formulas that can run, in document order. */
  formulas: FormulaField[]
  /** The item formulas that can run, per list. */
  items: Map<FormListNode, FormulaField[]>
  /** The circles, each as the formulas on it. */
  cycles: { node: FormFieldNode; label: string }[][]
  /** The ids of the fields on a circle, which are not worked out. */
  blocked: Set<string>
}

/**
 * The fields whose formulas read one another in a circle, each circle as
 * the names on it, e.g. `[['total', 'tax']]`. A formula reading its own
 * field is a circle of one. The items' fields are named with their list's,
 * e.g. `rows.total`; a circle can go through the document's formulas and
 * the items' alike. Pass the form's `functions` (or their names) when it
 * has its own `sum`, `min` or `max`, which may read any key of the items.
 */
export function findFormulaCycles(
  document: FormDocument,
  functions?: Readonly<Record<string, FormFunction>> | readonly string[],
): string[][] {
  return analyseFormulas(document, functions).cycles.map((cycle) => cycle.map(({ label }) => label))
}

/**
 * Every formula of a document, the items' included, as one set: a
 * formula reading a list reads all its items' formulas, and an item's
 * formula reading `values` reads the document's.
 */
export function analyseFormulas(
  document: FormDocument,
  functions?: Readonly<Record<string, FormFunction>> | readonly string[],
): FormulaAnalysis {
  const root = collect(document.nodes, '')
  const all: Formula[] = []
  const scopes = new Map<Formula, Scope>()
  const walk = (scope: Scope) => {
    for (const formula of scope.formulas) {
      all.push(formula)
      scopes.set(formula, scope)
    }
    for (const { scope: inner } of scope.lists) walk(inner)
  }
  walk(root)
  const index = new Map(all.map((formula, i) => [formula, i]))

  const everyFormula = (scope: Scope): Formula[] => [
    ...scope.formulas,
    ...scope.lists.flatMap(({ scope: inner }) => everyFormula(inner)),
  ]
  // What reading `path` in a scope reads: its formulas there, and all of a
  // list's. With a `key`, as in `sum(values.rows, 'total')`, only that key
  // of the list's items.
  const reads = (scope: Scope, path: string, key?: string): Formula[] => [
    ...scope.formulas.filter(({ name }) => related(name, path)),
    ...scope.lists
      .filter(({ node }) => node.name !== undefined && related(node.name, path))
      .flatMap(({ node, scope: inner }) =>
        key !== undefined && node.name === path ? reads(inner, key) : everyFormula(inner),
      ),
  ]
  const edges = all.map((formula) => {
    const scope = scopes.get(formula)!
    const targets = new Set<Formula>()
    for (const read of readsOf(formula.expression.ast, functions)) {
      if (read.root === 'value') targets.add(formula)
      else if (read.root === 'values')
        for (const t of reads(root, read.path, read.key)) targets.add(t)
      else if (scope !== root) for (const t of reads(scope, read.path, read.key)) targets.add(t)
    }
    return [...targets].map((target) => index.get(target)!)
  })

  // Tarjan's way: every strongly connected group of more than one, or one
  // that reads itself, is a circle.
  const order: number[] = Array.from({ length: all.length }, () => -1)
  const low: number[] = []
  const stack: number[] = []
  const onStack = new Set<number>()
  const groups: number[][] = []
  let counter = 0
  function connect(at: number) {
    order[at] = low[at] = counter++
    stack.push(at)
    onStack.add(at)
    for (const next of edges[at]!) {
      if (order[next] === -1) {
        connect(next)
        low[at] = Math.min(low[at]!, low[next]!)
      } else if (onStack.has(next)) low[at] = Math.min(low[at]!, order[next]!)
    }
    if (low[at] !== order[at]) return
    const group: number[] = []
    let member: number
    do {
      member = stack.pop()!
      onStack.delete(member)
      group.unshift(member)
    } while (member !== at)
    if (group.length > 1 || edges[at]!.includes(at)) groups.push(group)
  }
  for (let i = 0; i < all.length; i++) if (order[i] === -1) connect(i)
  groups.sort((a, b) => a[0]! - b[0]!)

  const blocked = new Set<string>()
  const cycles = groups.map((group) =>
    group.map((i) => {
      const { node, label } = all[i]!
      blocked.add(node.id)
      return { node, label }
    }),
  )
  const runnable = (scope: Scope): FormulaField[] =>
    scope.formulas
      .filter(({ node }) => !blocked.has(node.id))
      .map(({ name, expression }) => ({ name, expression }))
  const items = new Map<FormListNode, FormulaField[]>()
  const fill = (scope: Scope) => {
    for (const { node, scope: inner } of scope.lists) {
      items.set(node, runnable(inner))
      fill(inner)
    }
  }
  fill(root)
  return { formulas: runnable(root), items, cycles, blocked }
}

/** The functions that take a list and one key of its items, e.g. `sum(values.rows, 'total')`. */
const keyed = new Set(['sum', 'min', 'max'])

interface Read {
  root: 'values' | 'item' | 'value'
  path: string
  key?: string
}

/** What an expression reads, like its `fields` and `itemFields`, with the keys aggregates read. */
function readsOf(
  ast: ExpressionNode,
  functions: Readonly<Record<string, FormFunction>> | readonly string[] | undefined,
): Read[] {
  // A function of the form's own by the same name is called instead, and may read anything.
  const own = (name: string) =>
    Array.isArray(functions)
      ? functions.includes(name)
      : !!functions && Object.hasOwn(functions, name)
  const result: Read[] = []
  const member = (node: ExpressionNode, key?: string) => {
    for (const root of ['values', 'item'] as const) {
      const path = pathOf(node, root)
      if (path === undefined) continue
      result.push({ root, path, key })
      computedKeys(node).forEach(visit)
      return true
    }
    return false
  }
  function visit(node: ExpressionNode) {
    switch (node.kind) {
      case 'name':
        result.push({ root: node.name, path: '' })
        return
      case 'member':
        if (!member(node)) {
          visit(node.object)
          visit(node.key)
        }
        return
      case 'call': {
        const [list, key, ...rest] = node.args
        if (
          keyed.has(node.name) &&
          !own(node.name) &&
          list?.kind === 'member' &&
          key?.kind === 'literal' &&
          typeof key.value === 'string' &&
          rest.length === 0 &&
          member(list, key.value)
        )
          return
        node.args.forEach(visit)
        return
      }
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
  visit(ast)
  return result
}

function collect(nodes: readonly FormNode[], prefix: string): Scope {
  const scope: Scope = { formulas: [], lists: [] }
  for (const node of valueNodes(nodes)) {
    if (isList(node)) {
      scope.lists.push({ node, scope: collect(node.children, `${prefix}${node.name}.`) })
      continue
    }
    if (!isField(node) || !node.formula) continue
    const expression = tryCompileExpression(node.formula)
    if (expression)
      scope.formulas.push({ node, name: node.name!, label: prefix + node.name!, expression })
  }
  return scope
}

/**
 * Works out every formula of the form at once, the items' included, and
 * writes the results into `values`, going over them again until nothing
 * changes. Formulas on a circle are left out. The renderer's watchers keep
 * results up to date in the page; on the server, where watchers run only
 * once, this gives the same values the page will have, so a formula reading
 * the items' formulas is not left behind.
 */
export function settleFormulas(
  document: FormDocument,
  values: Record<string, unknown>,
  functions?: Readonly<Record<string, FormFunction>>,
  analysis: FormulaAnalysis = analyseFormulas(document, functions),
) {
  const top = analysis.formulas
  // Each pass settles at least one more formula in a chain, so this many always do.
  for (let pass = 0; pass <= top.length; pass++) {
    let changed = settleItems(document.nodes, values, values, functions, analysis.items)
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
  items: ReadonlyMap<FormListNode, FormulaField[]>,
) {
  let changed = false
  for (const node of valueNodes(nodes)) {
    if (!isList(node)) continue
    const rows = getPath(target, node.name)
    if (!Array.isArray(rows)) continue
    const formulas = items.get(node) ?? []
    for (const item of rows as unknown[]) {
      if (item === null || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      for (let pass = 0; pass <= formulas.length; pass++) {
        let again = settleItems(node.children, row, values, functions, items)
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
