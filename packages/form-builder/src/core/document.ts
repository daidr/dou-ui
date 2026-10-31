import type {
  FormContainerNode,
  FormDocument,
  FormFieldNode,
  FormListNode,
  FormNode,
  FormPageNode,
  FormSectionNode,
  FormStepsNode,
  FormTabsNode,
} from './types'

/** A document with nothing in it. */
export function emptyDocument(): FormDocument {
  return { version: 1, nodes: [] }
}

let warnedVersion = false

/** Warn once, for the whole page, about a document of a version this package does not know. */
export function checkVersion(document: FormDocument) {
  if (document.version === 1 || warnedVersion) return
  warnedVersion = true
  console.warn(
    `[dou-ui] form document version ${String(document.version)} is not supported; it is read as version 1`,
  )
}

let counter = 0

/** A short id that is unique enough within one document, e.g. `f-lz3k9a-1`. */
export function createId(prefix = 'f'): string {
  counter = (counter + 1) % 1679616
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}

const CONTAINERS = new Set(['section', 'tabs', 'steps', 'page', 'list'])

export const isSection = (node: FormNode): node is FormSectionNode => node.type === 'section'
export const isTabs = (node: FormNode): node is FormTabsNode => node.type === 'tabs'
export const isSteps = (node: FormNode): node is FormStepsNode => node.type === 'steps'
export const isPage = (node: FormNode): node is FormPageNode => node.type === 'page'
export const isList = (node: FormNode): node is FormListNode => node.type === 'list'
/** Whether a node holds other nodes: a section, tabs, steps, a page or a list. */
export const isContainer = (node: FormNode): node is FormContainerNode => CONTAINERS.has(node.type)
/** Whether a node is a field, of a built-in or a registered type. */
export const isField = (node: FormNode): node is FormFieldNode => !CONTAINERS.has(node.type)

/** Every node in document order, containers before their children, the fields of list items included. */
export function* walkNodes(nodes: readonly FormNode[]): Generator<FormNode> {
  for (const node of nodes) {
    yield node
    if (isContainer(node)) yield* walkNodes(node.children)
  }
}

/**
 * The nodes that write a value of their own, in document order: fields
 * with a `name` and lists. Fields inside a list belong to its items, so
 * they are not among them.
 */
export function valueNodes(nodes: readonly FormNode[]): (FormFieldNode | FormListNode)[] {
  const result: (FormFieldNode | FormListNode)[] = []
  const visit = (list: readonly FormNode[]) => {
    for (const node of list) {
      if (isList(node)) result.push(node)
      else if (isContainer(node)) visit(node.children)
      else if (node.name) result.push(node)
    }
  }
  visit(nodes)
  return result
}

/** The fields that write a value, in document order, outside lists. */
export function fieldNodes(document: FormDocument): FormFieldNode[] {
  return valueNodes(document.nodes).filter(isField)
}

/** The node with this id, anywhere in the document. */
export function findNode(document: FormDocument, id: string): FormNode | undefined {
  for (const node of walkNodes(document.nodes)) if (node.id === id) return node
  return undefined
}

const keysOf = (path: string) => path.split('.')

/** The value at a dotted path, or `undefined` when part of it is missing. */
export function getPath(model: unknown, path: string): unknown {
  let value = model
  for (const key of keysOf(path)) {
    if (value === null || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

/** Write a value at a dotted path, creating the objects on the way. */
export function setPath(model: Record<string, unknown>, path: string, value: unknown) {
  const keys = keysOf(path)
  const last = keys.pop()!
  let target = model
  for (const key of keys) {
    let next = target[key]
    if (next === null || typeof next !== 'object') next = target[key] = {}
    target = next as Record<string, unknown>
  }
  target[last] = value
}

/** Remove the value at a dotted path, if it is there. */
export function unsetPath(model: Record<string, unknown>, path: string) {
  const keys = keysOf(path)
  const last = keys.pop()!
  let target: unknown = model
  for (const key of keys) {
    if (target === null || typeof target !== 'object') return
    target = (target as Record<string, unknown>)[key]
  }
  if (target !== null && typeof target === 'object')
    delete (target as Record<string, unknown>)[last]
}

/** A deep copy of plain data, so a default is never shared between forms. */
export function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(cloneValue) as T
  if (value instanceof Date) return new Date(value) as T
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) result[key] = cloneValue(item)
  return result as T
}
