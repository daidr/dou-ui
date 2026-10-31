import type { FormDocument, FormFieldNode, FormNode, FormSectionNode } from './types'

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

export function isSection(node: FormNode): node is FormSectionNode {
  return node.type === 'section'
}

/** Every node in document order, groups before their children. */
export function* walkNodes(nodes: readonly FormNode[]): Generator<FormNode> {
  for (const node of nodes) {
    yield node
    if (isSection(node)) yield* walkNodes(node.children)
  }
}

/** The nodes that write a value, in document order. */
export function fieldNodes(document: FormDocument): FormFieldNode[] {
  const result: FormFieldNode[] = []
  for (const node of walkNodes(document.nodes)) {
    if (!isSection(node) && node.name) result.push(node)
  }
  return result
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

/** A deep copy of plain data, so a default is never shared between forms. */
export function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(cloneValue) as T
  if (value instanceof Date) return new Date(value) as T
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) result[key] = cloneValue(item)
  return result as T
}
