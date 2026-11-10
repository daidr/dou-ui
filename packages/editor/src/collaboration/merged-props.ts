import type { NodeType } from 'prosemirror-model'
import * as Y from 'yjs'
import { keysBetween, orderKeys } from './order'

/*
 * Props whose lists of `{ id }` items merge item by item when edited
 * together, e.g. the nodes and edges of a whiteboard in a block. A block
 * type names them in its spec:
 *
 *   mergeProps: { board: { lists: ['nodes', 'edges'], objects: ['data'] } }
 *
 * (`{ board: ['nodes', 'edges'] }` for lists alone) and such a prop is
 * stored as
 *
 *   props.board: Y.Map {
 *     nodes: Y.Map<item id, Y.Map<field, value>>
 *     edges: Y.Map<item id, Y.Map<field, value>>
 *     (other fields, e.g. version, as plain values)
 *   }
 *
 * with an item's place in its list as an order key among its fields, and
 * its `objects` fields (e.g. a node's `data`) as a Y.Map of
 * their keys. Two people moving two different nodes, changing two fields
 * of the same node, or two keys of its data (its text and its color) both
 * keep their change. An item someone removed stays removed when another
 * person changes it meanwhile.
 */

type Item = Record<string, unknown>

/** The field holding an item's place in its list; no item field is named so. */
const ORDER = '\u0000order'
type Shared = Y.Map<unknown>

/** How a prop merges: its fields that are lists of items, and the item fields merged key by key. */
export interface MergeSpec {
  lists: readonly string[]
  objects: readonly string[]
}

type MergePropsSpec = Record<
  string,
  readonly string[] | { lists: readonly string[]; objects?: readonly string[] }
>

/** The props a block type merges, by name. */
export function mergedPropsOf(type: NodeType): Record<string, MergeSpec> | undefined {
  const spec = type.spec.mergeProps as MergePropsSpec | undefined
  if (!spec) return undefined
  return Object.fromEntries(
    Object.entries(spec).map(([name, value]) => [
      name,
      Array.isArray(value)
        ? { lists: value, objects: [] }
        : { lists: (value as MergeSpec).lists, objects: (value as MergeSpec).objects ?? [] },
    ]),
  )
}

const isObject = (value: unknown): value is Item =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isItem = (value: unknown): value is Item & { id: string } =>
  isObject(value) && typeof value.id === 'string' && !!value.id

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** Reads a merged prop back: lists in a stable order (by id), the same on every client. */
export function readMerged(value: unknown, { lists }: MergeSpec): unknown {
  if (!(value instanceof Y.Map)) return value instanceof Y.AbstractType ? value.toJSON() : value
  const result: Item = {}
  for (const [key, field] of value.entries()) {
    if (lists.includes(key) && field instanceof Y.Map) {
      const items: [string, Item][] = []
      for (const [id, fields] of field.entries()) {
        if (!(fields instanceof Y.Map)) continue
        const { [ORDER]: order, ...rest } = fields.toJSON() as Item
        items.push([typeof order === 'string' ? order : '', { ...rest, id }])
      }
      // by place, then by id: the same order on every client
      items.sort(([a, x], [b, y]) =>
        a === b ? (x.id as string).localeCompare(y.id as string) : a < b ? -1 : 1,
      )
      result[key] = items.map(([, item]) => item)
    } else result[key] = field instanceof Y.AbstractType ? field.toJSON() : field
  }
  return result
}

/** Writes an object's keys into a map, only those that changed since `before`. */
function writeKeys(map: Shared, after: Item, before?: Item) {
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue
    if (before ? !same(before[key], value) : !same(map.get(key), value)) map.set(key, value)
  }
  for (const key of Array.from(map.keys())) {
    if (after[key] !== undefined) continue
    if (!before || before[key] !== undefined) map.delete(key)
  }
}

/** A field as it is first stored: an object one of `objects` as a map of its keys. */
function newField(key: string, value: unknown, objects: readonly string[]) {
  if (!objects.includes(key) || !isObject(value)) return value
  const map = new Y.Map<unknown>()
  for (const [name, field] of Object.entries(value)) if (field !== undefined) map.set(name, field)
  return map
}

/** Writes one item's fields, only those that changed. */
function writeItem(
  map: Shared,
  item: Item & { id: string },
  objects: readonly string[],
  before?: Item,
) {
  const existing = map.get(item.id)
  if (!(existing instanceof Y.Map)) {
    // removed by someone else meanwhile: it stays removed
    if (!before) map.set(item.id, newItem(item, objects))
    return
  }
  for (const [key, value] of Object.entries(item)) {
    if (key === 'id' || value === undefined) continue
    const stored = existing.get(key)
    const old = before?.[key]
    if (objects.includes(key) && isObject(value) && stored instanceof Y.Map) {
      writeKeys(stored as Shared, value, before ? (isObject(old) ? old : {}) : undefined)
      continue
    }
    const changed = before
      ? !same(old, value)
      : !same(stored instanceof Y.AbstractType ? stored.toJSON() : stored, value)
    if (changed) existing.set(key, newField(key, value, objects))
  }
  for (const key of Array.from(existing.keys())) {
    if (key === ORDER || item[key] !== undefined) continue
    if (!before || before[key] !== undefined) existing.delete(key)
  }
}

/** Brings a list from `before` to `after`; without `before`, from what the map holds. */
function writeList(map: Shared, after: unknown[], objects: readonly string[], before?: unknown[]) {
  const items = after.filter(isItem)
  const ids = new Set(items.map((item) => item.id))
  const old = new Map((before ?? []).filter(isItem).map((item) => [item.id, item]))
  const gone = before ? Array.from(old.keys()) : Array.from(map.keys())
  for (const id of gone) if (!ids.has(id)) map.delete(id)
  for (const item of items) writeItem(map, item, objects, before ? old.get(item.id) : undefined)
  // places: only those of the items that moved, or have none yet
  const stored = items
    .map((item) => map.get(item.id))
    .filter((fields): fields is Shared => fields instanceof Y.Map)
  const keys = stored.map((fields) => {
    const order = fields.get(ORDER)
    return typeof order === 'string' ? order : null
  })
  const next = orderKeys(keys)
  stored.forEach((fields, i) => {
    if (keys[i] !== next[i]) fields.set(ORDER, next[i])
  })
}

/** A new item, for a map not yet in the document (which can't be read). */
function newItem(item: Item, objects: readonly string[], order?: string): Shared {
  const fields = new Y.Map<unknown>()
  if (order !== undefined) fields.set(ORDER, order)
  for (const [key, value] of Object.entries(item))
    if (key !== 'id' && value !== undefined) fields.set(key, newField(key, value, objects))
  return fields
}

function newList(items: unknown[], objects: readonly string[]): Shared {
  const list = new Y.Map<unknown>()
  const valid = items.filter(isItem)
  const keys = keysBetween(null, null, valid.length)
  valid.forEach((item, i) => list.set(item.id, newItem(item, objects, keys[i])))
  return list
}

/** A merged prop as it is first stored: built without reading, as nothing is in the document yet. */
export function newMerged(value: unknown, { lists, objects }: MergeSpec): unknown {
  if (!isObject(value)) return value
  const map = new Y.Map<unknown>()
  for (const [key, field] of Object.entries(value)) {
    if (field === undefined) continue
    map.set(key, lists.includes(key) && Array.isArray(field) ? newList(field, objects) : field)
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
  spec: MergeSpec,
  after: unknown,
  before?: unknown,
) {
  if (!isObject(after)) {
    if (!same(props.get(name), after)) props.set(name, after)
    return
  }
  const stored = props.get(name)
  if (!(stored instanceof Y.Map)) {
    props.set(name, newMerged(after, spec))
    return
  }
  const { lists, objects } = spec
  const map = stored as Shared
  const base = isObject(before) ? before : undefined
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue
    if (lists.includes(key) && Array.isArray(value)) {
      const list = map.get(key)
      const old = base?.[key]
      if (!(list instanceof Y.Map)) map.set(key, newList(value, objects))
      else writeList(list as Shared, value, objects, Array.isArray(old) ? old : undefined)
    } else if (base ? !same(base[key], value) : !same(map.get(key), value)) map.set(key, value)
  }
  for (const key of Array.from(map.keys())) if (after[key] === undefined) map.delete(key)
}
