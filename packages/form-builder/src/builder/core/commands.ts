import { cloneValue, createId, isContainer, isList, isPage, walkNodes } from '../../core/document'
import type {
  FormContainerNode,
  FormDocument,
  FormFieldNode,
  FormListNode,
  FormNode,
  FormPageNode,
  FormSectionNode,
} from '../../core/types'
import type { FormFieldType } from '../../fields/define'
import type { FormBuilderMessages } from '../locale'
import { formatMessage } from '../../locale'
import { canContainFormNode, formNodePlaces } from './transaction'
import type { FormBuilderTransaction, FormDocumentPatch } from './transaction'

/** Where a new node goes: into a container (`null`: the top) at an index. */
export interface FormBuilderInsertPlace {
  parent: string | null
  index: number
}

/** The list a node's name is a key of, or `null` for names at the top of the form. */
export function scopeOf(document: FormDocument, parent: string | null): FormListNode | null {
  const map = formNodePlaces(document)
  let id = parent
  while (id !== null) {
    const place = map.get(id)
    if (!place) return null
    if (isList(place.node)) return place.node
    id = place.parent?.id ?? null
  }
  return null
}

/** The names already used in a scope: fields and lists, not the fields of nested lists. */
export function namesIn(document: FormDocument, scope: FormListNode | null): Set<string> {
  const names = new Set<string>()
  const visit = (nodes: readonly FormNode[]) => {
    for (const node of nodes) {
      if ('name' in node && node.name) names.add(node.name)
      if (isContainer(node) && !isList(node)) visit(node.children)
    }
  }
  visit(scope ? scope.children : document.nodes)
  return names
}

/** `select3` after `select` and `select2`: the type in camel case and the first free number. */
export function uniqueName(base: string, taken: ReadonlySet<string>) {
  const stem = base.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())
  for (let index = 1; ; index++) {
    const name = `${stem}${index}`
    if (!taken.has(name)) return name
  }
}

const newPage = (title: string): FormPageNode => ({
  id: createId('p'),
  type: 'page',
  title,
  children: [],
})

/** A new node of a type, with an id, a free name and texts to start from. */
export function createNode(
  type: string,
  context: {
    fields: Map<string, FormFieldType>
    messages: FormBuilderMessages
    taken: ReadonlySet<string>
  },
): FormNode {
  const { messages, taken } = context
  const label = context.fields.get(type)?.label ?? messages.types[type] ?? type
  switch (type) {
    case 'section':
      return { id: createId('s'), type: 'section', title: label, children: [] }
    case 'tabs':
    case 'steps': {
      const text = type === 'tabs' ? messages.created.page : messages.created.step
      return {
        id: createId(type === 'tabs' ? 't' : 'st'),
        type,
        children: [1, 2].map((index) => newPage(formatMessage(text, { index }))),
      }
    }
    case 'page':
      return newPage(formatMessage(messages.created.page, { index: 1 }))
    case 'list':
      return {
        id: createId('l'),
        type: 'list',
        name: uniqueName('list', taken),
        label,
        children: [],
      }
  }
  const spec = context.fields.get(type)
  const node: FormFieldNode = { id: createId(), type }
  if (spec?.kind === 'display') {
    if (type === 'text') node.props = { content: messages.created.text }
    if (type === 'alert') node.props = { title: messages.created.alert }
    return node
  }
  node.name = uniqueName(type, taken)
  node.label = label
  if (spec?.optionsProp) {
    const options = [1, 2, 3].map((index) => ({
      label: formatMessage(messages.created.option, { index }),
      value: `option${index}`,
    }))
    node.props = { [spec.optionsProp]: options }
    // A tree's options are nodes: the same shape, read as `label` and `value`.
  }
  return node
}

/** The page of tabs or steps the builder shows, given which ones are open. */
export type ShownPage = (container: FormContainerNode) => FormPageNode | undefined

/**
 * Where a node of `type` goes when added from the palette: inside the
 * last selected container (the shown page of tabs and steps), else after
 * the last selected node, else at the end of the form.
 */
export function insertPlace(
  document: FormDocument,
  selection: readonly string[],
  type: string,
  shown: ShownPage,
): FormBuilderInsertPlace {
  const map = formNodePlaces(document)
  const probe = { id: '', type, children: [] } as unknown as FormNode
  const last = selection[selection.length - 1]
  let place = last ? map.get(last) : undefined
  while (place) {
    let target: FormNode = place.node
    if (target.type === 'tabs' || target.type === 'steps') {
      const page = shown(target as FormContainerNode)
      if (page) target = page
    }
    if (isContainer(target) && canContainFormNode(target, probe))
      return { parent: target.id, index: target.children.length }
    const parent = place.parent
    if (canContainFormNode(parent, probe))
      return { parent: parent?.id ?? null, index: place.index + 1 }
    place = parent ? map.get(parent.id) : undefined
  }
  return { parent: null, index: document.nodes.length }
}

/** The selected nodes without the ones inside other selected nodes, in document order. */
export function topmost(document: FormDocument, ids: readonly string[]): string[] {
  const map = formNodePlaces(document)
  const chosen = new Set(ids.filter((id) => map.has(id)))
  const result: string[] = []
  for (const node of walkNodes(document.nodes)) {
    if (!chosen.has(node.id)) continue
    let up = map.get(node.id)!.parent
    let inside = false
    while (up) {
      if (chosen.has(up.id)) {
        inside = true
        break
      }
      up = map.get(up.id)!.parent
    }
    if (!inside) result.push(node.id)
  }
  return result
}

/** A copy of a node with new ids, and a free name for the copy itself. */
export function copyNode(node: FormNode, taken: Set<string>): FormNode {
  const copy = cloneValue(node)
  for (const each of walkNodes([copy])) each.id = createId(each.id.split('-')[0] || 'f')
  if ('name' in copy && copy.name) {
    const stem = copy.name.replace(/\d+$/, '')
    copy.name = uniqueName(stem || copy.type, taken)
    taken.add(copy.name)
  }
  return copy
}

/** What the commands below read besides the document. */
export interface CommandContext {
  fields: Map<string, FormFieldType>
  messages: FormBuilderMessages
}

/** Remove nodes; the node to select afterwards: the next one, else the one before, else the parent. */
export function removeNodes(tr: FormBuilderTransaction, ids: readonly string[]) {
  const ids2 = topmost(tr.doc, ids)
  if (!ids2.length) return { removed: 0, next: undefined as string | undefined }
  const map = formNodePlaces(tr.doc)
  const last = map.get(ids2[ids2.length - 1]!)!
  const siblings = last.parent ? last.parent.children : tr.doc.nodes
  const gone = new Set(ids2)
  const after = siblings.slice(last.index + 1).find((node) => !gone.has(node.id))
  let before: FormNode | undefined
  for (let at = last.index - 1; at >= 0 && !before; at--)
    if (!gone.has(siblings[at]!.id)) before = siblings[at]
  let next = after?.id ?? before?.id
  if (!next) {
    let up = last.parent
    while (up && gone.has(up.id)) up = map.get(up.id)?.parent ?? null
    next = up?.id
  }
  for (const id of ids2) tr.remove(id)
  return { removed: ids2.length, next }
}

/** Put a copy of each node right after it; the ids of the copies. */
export function duplicateNodes(tr: FormBuilderTransaction, ids: readonly string[]) {
  const copies: string[] = []
  for (const id of topmost(tr.doc, ids)) {
    const place = formNodePlaces(tr.doc).get(id)
    if (!place) continue
    const parent = place.parent?.id ?? null
    const taken = namesIn(tr.doc, scopeOf(tr.doc, parent))
    const copy = copyNode(place.node, taken)
    tr.insert(copy, parent, place.index + 1)
    copies.push(copy.id)
  }
  return copies
}

/**
 * Move each node one place up (`-1`) or down (`1`) among its siblings.
 * Nodes already at the edge stay, and so do the selected ones next to
 * them, so a selection keeps its shape. Returns whether anything moved.
 */
export function moveNodes(tr: FormBuilderTransaction, ids: readonly string[], delta: -1 | 1) {
  const chosen = topmost(tr.doc, ids)
  const byParent = new Map<string | null, number[]>()
  const map = formNodePlaces(tr.doc)
  for (const id of chosen) {
    const place = map.get(id)!
    const key = place.parent?.id ?? null
    const list = byParent.get(key) ?? []
    list.push(place.index)
    byParent.set(key, list)
  }
  let moved = false
  for (const [parent, indexes] of byParent) {
    const siblings =
      parent === null ? tr.doc.nodes : (map.get(parent)!.node as FormContainerNode).children
    indexes.sort((a, b) => (delta < 0 ? a - b : b - a))
    const blocked = new Set<number>()
    for (const index of indexes) {
      const target = index + delta
      if (target < 0 || target >= siblings.length || blocked.has(target)) {
        blocked.add(index)
        continue
      }
      const id = siblings[index]!.id
      tr.move(id, parent, target)
      moved = true
    }
  }
  return moved
}

/** Put nodes of one container into a new section where the first of them was; its id. */
export function wrapNodes(
  tr: FormBuilderTransaction,
  ids: readonly string[],
  context: CommandContext,
) {
  const chosen = topmost(tr.doc, ids)
  if (!chosen.length) return undefined
  const map = formNodePlaces(tr.doc)
  const first = map.get(chosen[0]!)!
  const parent = first.parent
  if (chosen.some((id) => map.get(id)!.parent !== parent || isPage(map.get(id)!.node)))
    return undefined
  const section = createNode('section', { ...context, taken: new Set() }) as FormSectionNode
  const parentId = parent?.id ?? null
  tr.insert(section, parentId, first.index)
  chosen.forEach((id, index) => tr.move(id, section.id, index))
  return section.id
}

/**
 * Move nodes, in document order, into a container (`null`: the top) so
 * that they start at `index` of its children as they are now (the moved
 * nodes counted). Returns whether anything changed.
 */
export function moveNodesTo(
  tr: FormBuilderTransaction,
  ids: readonly string[],
  parent: string | null,
  index: number,
) {
  const chosen = topmost(tr.doc, ids)
  if (!chosen.length) return false
  const moving = new Set(chosen)
  const before = formNodePlaces(tr.doc)
  const siblings = (doc: FormDocument) =>
    parent === null
      ? doc.nodes
      : ((formNodePlaces(doc).get(parent)?.node as FormContainerNode | undefined)?.children ?? [])
  // The first node at or after `index` that stays: the moved nodes go in front of it.
  const anchor = siblings(tr.doc)
    .slice(index)
    .find((node) => !moving.has(node.id))?.id
  for (const id of chosen) {
    const map = formNodePlaces(tr.doc)
    const own = map.get(id)!
    const inside = (own.parent?.id ?? null) === parent
    let target = anchor ? map.get(anchor)!.index : siblings(tr.doc).length
    if (inside && own.index < target) target--
    tr.move(id, parent, target)
  }
  const after = formNodePlaces(tr.doc)
  const moved = chosen.some((id) => {
    const a = before.get(id)!
    const b = after.get(id)!
    return a.parent?.id !== b.parent?.id || a.index !== b.index
  })
  return moved
}

/**
 * Every place nodes can be moved to, in reading order: before each child
 * of each container and at its end. Places inside the moved nodes, in
 * pages not shown, or in containers that cannot hold them are left out.
 */
export function dropPlaces(
  document: FormDocument,
  ids: readonly string[],
  shown: ShownPage,
): FormBuilderInsertPlace[] {
  const map = formNodePlaces(document)
  const nodes = topmost(document, ids)
    .map((id) => map.get(id)?.node)
    .filter((node): node is FormNode => !!node)
  const moving = new Set(nodes.map((node) => node.id))
  const result: FormBuilderInsertPlace[] = []
  const visit = (holder: FormContainerNode | null, children: readonly FormNode[]) => {
    const fits = nodes.every((node) => canContainFormNode(holder, node))
    children.forEach((child, index) => {
      if (fits) result.push({ parent: holder?.id ?? null, index })
      if (moving.has(child.id) || !isContainer(child)) return
      if (child.type === 'tabs' || child.type === 'steps') {
        const page = shown(child as FormContainerNode)
        if (page) visit(page, page.children)
      } else visit(child as FormContainerNode, child.children)
    })
    if (fits) result.push({ parent: holder?.id ?? null, index: children.length })
  }
  visit(null, document.nodes)
  return result
}

/**
 * Turn the document into another, e.g. one imported as JSON or one changed
 * by another person, in as few steps as it takes: nodes only the old one
 * has go, nodes only the new one has come in, nodes in both move where the
 * new one has them and take its keys, and the settings follow. Nodes that
 * did not change stay the same objects. As steps of a transaction, so undo
 * brings the old document back.
 */
export function replaceDocument(tr: FormBuilderTransaction, next: FormDocument) {
  const wanted = new Map<string, FormNode>()
  for (const node of walkNodes(next.nodes)) wanted.set(node.id, node)

  // Nodes the new document has not, or has as another type, go first, with what they hold.
  for (const node of walkNodes(tr.doc.nodes)) {
    const target = wanted.get(node.id)
    if (target && target.type === node.type) continue
    if (formNodePlaces(tr.doc).has(node.id)) tr.remove(node.id)
  }

  // Then from the top down, so each node's container is in its place before the node.
  const place = (children: readonly FormNode[], parent: string | null) => {
    children.forEach((target, index) => {
      const at = formNodePlaces(tr.doc).get(target.id)
      if (!at) {
        // A node that is new with all it holds comes in whole; one holding nodes that are here, empty.
        const whole = ![...walkNodes([target])].some(
          (node) => node !== target && formNodePlaces(tr.doc).has(node.id),
        )
        const node = whole || !isContainer(target) ? target : { ...target, children: [] }
        tr.insert(node as FormNode, parent, index)
        if (!whole && isContainer(target)) place(target.children, target.id)
        return
      }
      if ((at.parent?.id ?? null) !== parent || at.index !== index)
        tr.move(target.id, parent, index)
      const patch = nodePatch(at.node, target)
      if (patch) tr.update(target.id, patch)
      if (isContainer(target)) place(target.children, target.id)
    })
  }
  place(next.nodes, null)

  const before = tr.doc as unknown as Record<string, unknown>
  const after = next as unknown as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key === 'nodes' || key === 'version' || sameValue(before[key], after[key])) continue
    patch[key] = after[key]
  }
  if (Object.keys(patch).length) tr.updateDocument(patch as FormDocumentPatch)
}

const sameValue = (a: unknown, b: unknown) =>
  a === b ||
  (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b))

/** The keys of `to` that differ from `from`, besides its place and what it holds; `null` when none. */
function nodePatch(from: FormNode, to: FormNode): Record<string, unknown> | null {
  const a = from as unknown as Record<string, unknown>
  const b = to as unknown as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  let changed = false
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === 'id' || key === 'type' || key === 'children' || sameValue(a[key], b[key])) continue
    patch[key] = b[key]
    changed = true
  }
  return changed ? patch : null
}
