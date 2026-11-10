import type { NodeType } from 'prosemirror-model'
import * as Y from 'yjs'

/*
 * Props whose lists of `{ id }` items merge item by item when edited
 * together, e.g. the nodes and edges of a whiteboard in a block. A block
 * type names them in its spec:
 *
 *   mergeProps: { board: ['nodes', 'edges'] }
 *
 * and such a prop is stored as
 *
 *   props.board: Y.Map {
 *     nodes: Y.Map<item id, Y.Map<field, value>>
 *     edges: Y.Map<item id, Y.Map<field, value>>
 *     (other fields, e.g. version, as plain values)
 *   }
 *
 * so two people moving two different nodes, or changing two fields of the
 * same node, both keep their change. An item someone removed stays removed
 * when another person changes it meanwhile.
 */

type Item = Record<string, unknown>
type Shared = Y.Map<unknown>

/** The prop names a block type merges, with the fields of each that are lists. */
export function mergedPropsOf(type: NodeType): Record<string, readonly string[]> | undefined {
  return type.spec.mergeProps as Record<string, readonly string[]> | undefined
}

const isObject = (value: unknown): value is Item =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isItem = (value: unknown): value is Item & { id: string } =>
  isObject(value) && typeof value.id === 'string' && !!value.id

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** Reads a merged prop back: lists in a stable order (by id), the same on every client. */
export function readMerged(value: unknown, lists: readonly string[]): unknown {
  if (!(value instanceof Y.Map)) return value instanceof Y.AbstractType ? value.toJSON() : value
  const result: Item = {}
  for (const [key, field] of value.entries()) {
    if (lists.includes(key) && field instanceof Y.Map) {
      const items: Item[] = []
      for (const [id, fields] of field.entries())
        if (fields instanceof Y.Map) items.push({ ...(fields.toJSON() as Item), id })
      items.sort((a, b) => (a.id as string).localeCompare(b.id as string))
      result[key] = items
    } else result[key] = field instanceof Y.AbstractType ? field.toJSON() : field
  }
  return result
}

/** Writes one item's fields, only those that changed. */
function writeItem(map: Shared, item: Item & { id: string }, before?: Item) {
  const existing = map.get(item.id)
  if (!(existing instanceof Y.Map)) {
    // removed by someone else meanwhile: it stays removed
    if (!before) map.set(item.id, newItem(item))
    return
  }
  for (const [key, value] of Object.entries(item)) {
    if (key === 'id' || value === undefined) continue
    if (before ? !same(before[key], value) : !same(existing.get(key), value))
      existing.set(key, value)
  }
  for (const key of Array.from(existing.keys())) {
    if (item[key] !== undefined) continue
    if (!before || before[key] !== undefined) existing.delete(key)
  }
}

/** Brings a list from `before` to `after`; without `before`, from what the map holds. */
function writeList(map: Shared, after: unknown[], before?: unknown[]) {
  const items = after.filter(isItem)
  const ids = new Set(items.map((item) => item.id))
  const old = new Map((before ?? []).filter(isItem).map((item) => [item.id, item]))
  const gone = before ? Array.from(old.keys()) : Array.from(map.keys())
  for (const id of gone) if (!ids.has(id)) map.delete(id)
  for (const item of items) writeItem(map, item, before ? old.get(item.id) : undefined)
}

/** A new item, for a map not yet in the document (which can't be read). */
function newItem(item: Item): Shared {
  const fields = new Y.Map<unknown>()
  for (const [key, value] of Object.entries(item))
    if (key !== 'id' && value !== undefined) fields.set(key, value)
  return fields
}

function newList(items: unknown[]): Shared {
  const list = new Y.Map<unknown>()
  for (const item of items.filter(isItem)) list.set(item.id, newItem(item))
  return list
}

/** A merged prop as it is first stored: built without reading, as nothing is in the document yet. */
export function newMerged(value: unknown, lists: readonly string[]): unknown {
  if (!isObject(value)) return value
  const map = new Y.Map<unknown>()
  for (const [key, field] of Object.entries(value)) {
    if (field === undefined) continue
    map.set(key, lists.includes(key) && Array.isArray(field) ? newList(field) : field)
  }
  return map
}

/**
 * Brings the stored prop from `before` to `after`. A value that isn't an
 * object is stored as it is.
 */
export function writeMerged(
  props: Shared,
  name: string,
  lists: readonly string[],
  after: unknown,
  before?: unknown,
) {
  if (!isObject(after)) {
    if (!same(props.get(name), after)) props.set(name, after)
    return
  }
  const stored = props.get(name)
  if (!(stored instanceof Y.Map)) {
    props.set(name, newMerged(after, lists))
    return
  }
  const map = stored as Shared
  const base = isObject(before) ? before : undefined
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue
    if (lists.includes(key) && Array.isArray(value)) {
      const list = map.get(key)
      const old = base?.[key]
      if (!(list instanceof Y.Map)) map.set(key, newList(value))
      else writeList(list as Shared, value, Array.isArray(old) ? old : undefined)
    } else if (base ? !same(base[key], value) : !same(map.get(key), value)) map.set(key, value)
  }
  for (const key of Array.from(map.keys())) if (after[key] === undefined) map.delete(key)
}
