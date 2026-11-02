import { isContainer, isField, isList, isPage, isSteps, isTabs } from './document'
import { checkExpression } from './expression'
import type { ExpressionProblem } from './expression'
import { analyseFormulas } from './formulas'
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
    | 'unknown-validator'
    | 'check-and-validator'
  /** The node at fault; none for the document's own problems. */
  nodeId?: string
  /**
   * Where the problem is, as a path into the document, e.g.
   * `nodes[1].children[0]` or `nodes[2].rules[0].check`; `version` for the
   * version, and `''` for a problem of the whole.
   */
  path: string
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
  /**
   * The names of the validators given to the renderer. Left out, a rule's
   * `validator` is not checked against them.
   */
  validators?: readonly string[]
}

const EXPRESSIONS = ['visibleWhen', 'disabledWhen', 'requiredWhen', 'formula'] as const

/**
 * The problems of a document, for an editor to point at, before it is
 * saved or rendered: ids used twice, fields without a name or sharing one,
 * types nobody registered, pages outside tabs and steps, expressions that
 * do not parse or read fields that are not there, formulas that read
 * each other, and rules naming a validator nobody gave.
 */
export function checkDocument(
  document: FormDocument,
  options: CheckDocumentOptions = {},
): DocumentProblem[] {
  const problems: DocumentProblem[] = []
  if (document.version !== 1)
    problems.push({
      code: 'version',
      path: 'version',
      text: String(document.version),
      message: `Version ${String(document.version)} is not known`,
    })
  const types = resolveFields(options.fields)
  const ids = new Set<string>()
  const known = scopeNames(document.nodes)
  /** Where each node is, by the node itself, so nodes that share an id each have their own. */
  const paths = new Map<FormNode, string>()

  /** `itemFields`: the names an item of the list around the nodes has; none outside lists. */
  function visit(
    nodes: readonly FormNode[],
    parent: FormNode | undefined,
    itemFields: readonly string[],
    at: string,
  ) {
    for (const [index, node] of nodes.entries()) {
      const path = `${at}[${index}]`
      paths.set(node, path)
      if (ids.has(node.id))
        problems.push({
          code: 'duplicate-id',
          nodeId: node.id,
          path,
          text: node.id,
          message: `The id "${node.id}" is used twice`,
        })
      ids.add(node.id)

      const pageParent = !!parent && (isTabs(parent) || isSteps(parent))
      if (isPage(node) && !pageParent)
        problems.push({
          code: 'misplaced-page',
          nodeId: node.id,
          path,
          text: node.id,
          message: 'A page belongs in tabs or steps',
        })
      if (pageParent && !isPage(node))
        problems.push({
          code: 'not-a-page',
          nodeId: node.id,
          path,
          text: node.id,
          message: 'Tabs and steps hold pages only',
        })

      if ((isTabs(node) || isSteps(node) || isList(node)) && !node.children?.length)
        problems.push({
          code: 'empty',
          nodeId: node.id,
          path,
          text: node.id,
          message: isList(node) ? 'The list has no fields' : `The ${node.type} have no pages`,
        })
      if (isList(node) && !node.name)
        problems.push({
          code: 'missing-name',
          nodeId: node.id,
          path,
          text: node.id,
          message: 'The list has no name',
        })

      if (isField(node)) {
        const type = types.get(node.type)
        if (!type)
          problems.push({
            code: 'unknown-type',
            nodeId: node.id,
            path,
            text: node.type,
            message: `There is no field type "${node.type}"`,
          })
        else if (type.kind !== 'display' && !node.name)
          problems.push({
            code: 'missing-name',
            nodeId: node.id,
            path,
            text: node.id,
            message: 'The field has no name',
          })
      }

      const expressions: [string, string | undefined][] = EXPRESSIONS.map((key) => [
        key,
        (node as Partial<Record<(typeof EXPRESSIONS)[number], string>>)[key],
      ])
      if (isField(node) || isList(node))
        (node.rules ?? []).forEach((rule, order) => {
          expressions.push([`rules.${order}.check`, rule.check])
          if (rule.validator === undefined) return
          const rulePath = `${path}.rules[${order}]`
          if (rule.check)
            problems.push({
              code: 'check-and-validator',
              nodeId: node.id,
              path: rulePath,
              text: rule.validator,
              message: 'A rule has both check and validator; only check runs',
            })
          else if (options.validators && !options.validators.includes(rule.validator))
            problems.push({
              code: 'unknown-validator',
              nodeId: node.id,
              path: `${rulePath}.validator`,
              text: rule.validator,
              message: `There is no validator "${rule.validator}"`,
            })
        })
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
            path: `${path}.${property.replace(/\.(\d+)/g, '[$1]')}`,
            property,
            text: source,
            expression: problem,
            message: `${property}: ${problem.message}`,
          })
      }

      if (isList(node))
        visit(node.children ?? [], node, scopeNames(node.children ?? []), `${path}.children`)
      else if (isContainer(node)) visit(node.children ?? [], node, itemFields, `${path}.children`)
    }
  }
  visit(document.nodes, undefined, [], 'nodes')
  duplicateNames(document.nodes, problems, paths)

  for (const cycle of analyseFormulas(document, options.functions).cycles) {
    const text = cycle.map(({ label }) => label)
    const node = cycle[0]!.node
    problems.push({
      code: 'formula-cycle',
      nodeId: node.id,
      path: paths.get(node) ?? '',
      text: text.join(' → '),
      message: `The formulas read each other: ${text.join(' -> ')}`,
    })
  }
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
function duplicateNames(
  nodes: readonly FormNode[],
  problems: DocumentProblem[],
  paths: ReadonlyMap<FormNode, string>,
) {
  const scan = (list: readonly FormNode[], seen: Set<string>) => {
    for (const node of list) {
      const name = nameOf(node)
      if (name) {
        if (seen.has(name))
          problems.push({
            code: 'duplicate-name',
            nodeId: node.id,
            path: paths.get(node) ?? '',
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
    throw new Error('[@dou-ui/form-builder] a form document must be an object')
  let current = document as { version?: unknown } & Record<string, unknown>
  if (current.version === undefined) current = { ...current, version: 1 }
  while (current.version !== 1) {
    const step = typeof current.version === 'number' ? migrations[current.version] : undefined
    if (!step)
      throw new Error(
        `[@dou-ui/form-builder] form document version ${String(current.version)} is not known`,
      )
    current = step(current)
  }
  return current as unknown as FormDocument
}

/** A part of some data that is not shaped like a form document. */
export interface DocumentShapeProblem {
  /** Where, as a path into the data, e.g. `nodes[2].children[0].label`; `''` for the whole. */
  path: string
  /** `type`: the value is of another kind; `required`: it is missing. */
  code: 'type' | 'required'
  /** What the value should be. */
  expected: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'span' | 'mark'
  /** An English description, for logs. */
  message: string
}

type Expected = DocumentShapeProblem['expected']

const NODE_KEYS: Record<string, Expected> = {
  id: 'string',
  type: 'string',
  name: 'string',
  label: 'string',
  help: 'string',
  title: 'string',
  description: 'string',
  addText: 'string',
  visibleWhen: 'string',
  disabledWhen: 'string',
  requiredWhen: 'string',
  formula: 'string',
  required: 'boolean',
  bordered: 'boolean',
  sortable: 'boolean',
  min: 'number',
  max: 'number',
  columns: 'number',
  span: 'span',
  props: 'object',
  source: 'object',
  rules: 'array',
  children: 'array',
}

const RULE_KEYS: Record<string, Expected> = {
  required: 'boolean',
  type: 'string',
  min: 'number',
  max: 'number',
  pattern: 'string',
  flags: 'string',
  check: 'string',
  validator: 'string',
  message: 'string',
  trigger: 'string',
}

const DOCUMENT_KEYS: Record<string, Expected> = {
  version: 'number',
  layout: 'string',
  labelAlign: 'string',
  labelWidth: 'number',
  size: 'string',
  requiredMark: 'mark',
  columns: 'number',
  nodes: 'array',
}

const CONTAINER_TYPES = new Set(['section', 'tabs', 'steps', 'page', 'list'])
const SHAPE_LIMIT = 50

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function fits(value: unknown, expected: Expected): boolean {
  switch (expected) {
    case 'object':
      return isObject(value)
    case 'array':
      return Array.isArray(value)
    case 'span':
      return (
        (typeof value === 'number' && Number.isFinite(value)) ||
        (isObject(value) && Object.values(value).every((each) => typeof each === 'number'))
      )
    case 'mark':
      return typeof value === 'boolean' || value === 'optional'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    default:
      return typeof value === expected
  }
}

/**
 * Where some data, e.g. JSON pasted into an editor, is not shaped like a
 * form document: a key holding the wrong kind of value, or a node without
 * its `id`, `type` or `children`. Problems name the path to the value, so
 * they can be found in the text. Run `checkDocument` on the result for
 * the problems of a document that is shaped right.
 */
export function checkDocumentShape(data: unknown): DocumentShapeProblem[] {
  const problems: DocumentShapeProblem[] = []
  const add = (path: string, code: 'type' | 'required', expected: Expected) => {
    if (problems.length >= SHAPE_LIMIT) return
    problems.push({
      path,
      code,
      expected,
      message:
        code === 'required'
          ? `${path} is missing`
          : `${path || 'The document'} should be ${expected === 'span' ? 'a number or an object of numbers' : expected === 'mark' ? 'a boolean or "optional"' : `a ${expected}`}`,
    })
  }
  const keys = (value: Record<string, unknown>, spec: Record<string, Expected>, path: string) => {
    for (const [key, expected] of Object.entries(spec))
      if (value[key] !== undefined && !fits(value[key], expected))
        add(`${path}.${key}`, 'type', expected)
  }
  const node = (value: unknown, path: string) => {
    if (!isObject(value)) return add(path, 'type', 'object')
    keys(value, NODE_KEYS, path)
    for (const key of ['id', 'type'] as const)
      if (value[key] === undefined) add(`${path}.${key}`, 'required', 'string')
    if (Array.isArray(value.rules))
      value.rules.forEach((rule, index) => {
        const at = `${path}.rules[${index}]`
        if (isObject(rule)) keys(rule, RULE_KEYS, at)
        else add(at, 'type', 'object')
      })
    if (isObject(value.source) && typeof value.source.name !== 'string')
      add(`${path}.source.name`, value.source.name === undefined ? 'required' : 'type', 'string')
    const container = typeof value.type === 'string' && CONTAINER_TYPES.has(value.type)
    if (container && value.children === undefined) add(`${path}.children`, 'required', 'array')
    if (Array.isArray(value.children))
      value.children.forEach((child, index) => node(child, `${path}.children[${index}]`))
  }
  if (!isObject(data)) {
    add('', 'type', 'object')
    return problems
  }
  for (const [key, expected] of Object.entries(DOCUMENT_KEYS))
    if (data[key] !== undefined && !fits(data[key], expected)) add(key, 'type', expected)
  if (data.nodes === undefined) add('nodes', 'required', 'array')
  if (Array.isArray(data.nodes)) data.nodes.forEach((each, index) => node(each, `nodes[${index}]`))
  return problems
}
