import {
  isContainer,
  isField,
  isList,
  isPage,
  isSteps,
  isTabs,
  valueNodes,
  walkNodes,
} from './document'
import { checkExpression } from './expression'
import type { ExpressionProblem } from './expression'
import { findFormulaCycles, findItemFormulaCycles } from './formulas'
import type { FormDocument, FormNode } from './types'
import { resolveFields } from '../fields/builtin'
import type { FormFieldType } from '../fields/define'

export interface DocumentProblem {
  code:
    | 'version'
    | 'duplicate-id'
    | 'missing-name'
    | 'duplicate-name'
    | 'unknown-type'
    | 'misplaced-page'
    | 'not-a-page'
    | 'empty'
    | 'expression'
    | 'formula-cycle'
  /** The node at fault; none for the document's own problems. */
  nodeId?: string
  /** The property at fault, e.g. `visibleWhen`, for an expression. */
  property?: string
  /** The id, name, type or expression source at fault, for the editor's message. */
  text: string
  /** The expression's own problem, for `expression`. */
  expression?: ExpressionProblem
  /** An English description, for logs. */
  message: string
}

export interface CheckDocumentOptions {
  /** Field types besides the built-in ones, as given to the renderer. */
  fields?: readonly FormFieldType<any>[]
  /** Functions the expressions can call besides the built-in ones. */
  functions?: readonly string[]
}

const EXPRESSIONS = ['visibleWhen', 'disabledWhen', 'requiredWhen', 'formula'] as const

/**
 * The problems of a document, for an editor to point at, before it is
 * saved or rendered: ids used twice, fields without a name or sharing one,
 * types nobody registered, pages outside tabs and steps, expressions that
 * do not parse or read fields that are not there, and formulas that read
 * each other.
 */
export function checkDocument(
  document: FormDocument,
  options: CheckDocumentOptions = {},
): DocumentProblem[] {
  const problems: DocumentProblem[] = []
  if (document.version !== 1)
    problems.push({
      code: 'version',
      text: String(document.version),
      message: `Version ${String(document.version)} is not known`,
    })
  const types = resolveFields(options.fields)
  const ids = new Set<string>()
  const known = scopeNames(document.nodes)

  /** `itemFields`: the names an item of the list around the nodes has; none outside lists. */
  function visit(
    nodes: readonly FormNode[],
    parent: FormNode | undefined,
    itemFields: readonly string[],
  ) {
    for (const node of nodes) {
      if (ids.has(node.id))
        problems.push({
          code: 'duplicate-id',
          nodeId: node.id,
          text: node.id,
          message: `The id "${node.id}" is used twice`,
        })
      ids.add(node.id)

      const pageParent = !!parent && (isTabs(parent) || isSteps(parent))
      if (isPage(node) && !pageParent)
        problems.push({
          code: 'misplaced-page',
          nodeId: node.id,
          text: node.id,
          message: 'A page belongs in tabs or steps',
        })
      if (pageParent && !isPage(node))
        problems.push({
          code: 'not-a-page',
          nodeId: node.id,
          text: node.id,
          message: 'Tabs and steps hold pages only',
        })

      if ((isTabs(node) || isSteps(node) || isList(node)) && !node.children?.length)
        problems.push({
          code: 'empty',
          nodeId: node.id,
          text: node.id,
          message: isList(node) ? 'The list has no fields' : `The ${node.type} have no pages`,
        })
      if (isList(node) && !node.name)
        problems.push({
          code: 'missing-name',
          nodeId: node.id,
          text: node.id,
          message: 'The list has no name',
        })

      if (isField(node)) {
        const type = types.get(node.type)
        if (!type)
          problems.push({
            code: 'unknown-type',
            nodeId: node.id,
            text: node.type,
            message: `There is no field type "${node.type}"`,
          })
        else if (type.kind !== 'display' && !node.name)
          problems.push({
            code: 'missing-name',
            nodeId: node.id,
            text: node.id,
            message: 'The field has no name',
          })
      }

      const expressions: [string, string | undefined][] = EXPRESSIONS.map((key) => [
        key,
        (node as Partial<Record<(typeof EXPRESSIONS)[number], string>>)[key],
      ])
      if (isField(node) || isList(node))
        (node.rules ?? []).forEach((rule, index) =>
          expressions.push([`rules.${index}.check`, rule.check]),
        )
      if (isField(node) && node.source?.arg) expressions.push(['source.arg', node.source.arg])
      for (const [property, source] of expressions) {
        if (!source) continue
        const found = checkExpression(source, {
          fields: known,
          itemFields,
          functions: options.functions,
        })
        for (const problem of found)
          problems.push({
            code: 'expression',
            nodeId: node.id,
            property,
            text: source,
            expression: problem,
            message: `${property}: ${problem.message}`,
          })
      }

      if (isList(node)) visit(node.children ?? [], node, scopeNames(node.children ?? []))
      else if (isContainer(node)) visit(node.children ?? [], node, itemFields)
    }
  }
  visit(document.nodes, undefined, [])
  duplicateNames(document.nodes, problems)

  const cycle = (names: string[], scope: readonly FormNode[]) =>
    problems.push({
      code: 'formula-cycle',
      nodeId: valueNodes(scope).find((node) => node.name === names[0])?.id,
      text: names.join(' → '),
      message: `The formulas read each other: ${names.join(' -> ')}`,
    })
  for (const names of findFormulaCycles(document)) cycle(names, document.nodes)
  for (const node of walkNodes(document.nodes))
    if (isList(node))
      for (const names of findItemFormulaCycles(node)) cycle(names, node.children ?? [])
  return problems
}

const nameOf = (node: FormNode) => (isList(node) || isField(node) ? node.name : undefined)

/** The names of one scope: the document's, or a list item's. Groups and pages share their parent's. */
function scopeNames(nodes: readonly FormNode[]): string[] {
  const result: string[] = []
  for (const node of nodes) {
    const name = nameOf(node)
    if (name) result.push(name)
    if (isContainer(node) && !isList(node)) result.push(...scopeNames(node.children ?? []))
  }
  return result
}

/** Names used twice within one scope. */
function duplicateNames(nodes: readonly FormNode[], problems: DocumentProblem[]) {
  const scan = (list: readonly FormNode[], seen: Set<string>) => {
    for (const node of list) {
      const name = nameOf(node)
      if (name) {
        if (seen.has(name))
          problems.push({
            code: 'duplicate-name',
            nodeId: node.id,
            text: name,
            message: `The name "${name}" is used twice`,
          })
        seen.add(name)
      }
      if (isList(node)) scan(node.children ?? [], new Set())
      else if (isContainer(node)) scan(node.children ?? [], seen)
    }
  }
  scan(nodes, new Set())
}

/** Upgrades from an older version of the document, by the version they start from. */
const migrations: Record<number, (document: any) => any> = {}

/**
 * The document in the current version (`1`). Documents of an older
 * version are upgraded step by step; there are none yet, so for now this
 * only checks the version. A document without a version is read as
 * version 1, as the renderer does. Throws for anything that is not a
 * document and for a version it does not know.
 */
export function migrateDocument(document: unknown): FormDocument {
  if (document === null || typeof document !== 'object' || Array.isArray(document))
    throw new Error('[dou-ui] a form document must be an object')
  let current = document as { version?: unknown } & Record<string, unknown>
  if (current.version === undefined) current = { ...current, version: 1 }
  while (current.version !== 1) {
    const step = typeof current.version === 'number' ? migrations[current.version] : undefined
    if (!step)
      throw new Error(`[dou-ui] form document version ${String(current.version)} is not known`)
    current = step(current)
  }
  return current as unknown as FormDocument
}
