import { isContainer, isPage, walkNodes } from '../../core/document'
import type { FormContainerNode, FormDocument, FormNode } from '../../core/types'

/**
 * The settings of a document besides its nodes, e.g. `layout` or
 * `columns`. `undefined` in a patch removes the setting.
 */
export type FormDocumentPatch = {
  [K in Exclude<keyof FormDocument, 'nodes' | 'version'>]?: FormDocument[K] | undefined
}

/**
 * Keys of a node to set; `undefined` removes the key. `id`, `type` and
 * `children` change through the other steps.
 */
export type FormNodePatch = Record<string, unknown>

/**
 * One change to a document. `parent` is the id of a container, or `null`
 * for the document's own nodes; `index` counts in that list, after the
 * node moved out of its old place.
 */
export type FormBuilderStep =
  | { type: 'insert'; node: FormNode; parent: string | null; index: number }
  | { type: 'remove'; id: string }
  | { type: 'update'; id: string; patch: FormNodePatch }
  | { type: 'move'; id: string; parent: string | null; index: number }
  | { type: 'updateDocument'; patch: FormDocumentPatch }

export interface FormBuilderTransactionMeta {
  /** `false` keeps the change out of undo, e.g. a change from another person. */
  history?: boolean
  /**
   * Changes of the same group within a second become one undo step, e.g.
   * the keys typed into one setting.
   */
  group?: string
  /** Where the change comes from, e.g. `inspector`, `keyboard` or an extension's name. */
  origin?: string
  [key: string]: unknown
}

/** Where a node sits: its container (`null` at the top) and position. */
export interface FormNodePlace {
  node: FormNode
  parent: FormContainerNode | null
  index: number
  /** How deep it sits, from 1 for the document's own nodes. */
  depth: number
}

const places = new WeakMap<FormDocument, Map<string, FormNodePlace>>()

/**
 * Where every node of a document sits, by id. Worked out once per
 * document object, which a transaction replaces on every change.
 */
export function placesOf(document: FormDocument): Map<string, FormNodePlace> {
  let map = places.get(document)
  if (map) return map
  map = new Map()
  const visit = (nodes: readonly FormNode[], parent: FormContainerNode | null, depth: number) => {
    nodes.forEach((node, index) => {
      map!.set(node.id, { node, parent, index, depth })
      if (isContainer(node)) visit(node.children, node, depth + 1)
    })
  }
  visit(document.nodes, null, 1)
  places.set(document, map)
  return map
}

const PROTECTED = new Set(['id', 'type', 'children'])

/** The node with `patch` applied; `undefined` removes a key. */
function patched(node: FormNode, patch: FormNodePatch): FormNode {
  const next: Record<string, unknown> = { ...node }
  for (const [key, value] of Object.entries(patch)) {
    if (PROTECTED.has(key)) continue
    if (value === undefined) delete next[key]
    else next[key] = value
  }
  return next as unknown as FormNode
}

/** The values `patch` replaces, as a patch that puts them back. */
function previous(node: FormNode, patch: FormNodePatch): FormNodePatch {
  const record = node as unknown as Record<string, unknown>
  const back: FormNodePatch = {}
  for (const key of Object.keys(patch)) if (!PROTECTED.has(key)) back[key] = record[key]
  return back
}

/**
 * Replace the list of children of `parent` (or the document's nodes),
 * copying only the containers on the way from the top to it.
 */
function withChildren(
  document: FormDocument,
  parent: string | null,
  change: (children: FormNode[]) => FormNode[],
): FormDocument {
  if (parent === null) return { ...document, nodes: change(document.nodes.slice()) }
  let place = placesOf(document).get(parent)
  if (!place) throw new Error(`[dou-ui] there is no node "${parent}" in the form`)
  if (!isContainer(place.node))
    throw new Error(`[dou-ui] the node "${parent}" holds no other nodes`)
  let replaced: FormNode = {
    ...place.node,
    children: change(place.node.children.slice()),
  } as FormContainerNode
  // Walk up, putting each new node in a copy of its parent.
  while (place) {
    const container = place.parent
    if (!container) {
      const nodes = document.nodes.slice()
      nodes[place.index] = replaced
      return { ...document, nodes }
    }
    const children = container.children.slice()
    children[place.index] = replaced
    replaced = { ...container, children } as FormContainerNode
    place = placesOf(document).get(container.id)
  }
  return document
}

function replaceNode(document: FormDocument, id: string, node: FormNode): FormDocument {
  const place = placesOf(document).get(id)!
  return withChildren(document, place.parent?.id ?? null, (children) => {
    children[place.index] = node
    return children
  })
}

/** Whether `parent` can hold `node`: pages go in tabs and steps, and only pages do. */
export function canHold(parent: FormNode | null, node: FormNode): boolean {
  const holdsPages = parent?.type === 'tabs' || parent?.type === 'steps'
  if (holdsPages) return isPage(node)
  if (isPage(node)) return false
  return parent === null || isContainer(parent)
}

/** Apply one step; the step that undoes it, and the new document. */
function applyStep(
  document: FormDocument,
  step: FormBuilderStep,
): [document: FormDocument, inverse: FormBuilderStep] {
  const map = placesOf(document)
  switch (step.type) {
    case 'insert': {
      if (map.has(step.node.id))
        throw new Error(`[dou-ui] the form already has a node "${step.node.id}"`)
      for (const node of walkNodes([step.node]))
        if (node !== step.node && map.has(node.id))
          throw new Error(`[dou-ui] the form already has a node "${node.id}"`)
      const next = withChildren(document, step.parent, (children) => {
        children.splice(clampIndex(step.index, children.length), 0, step.node)
        return children
      })
      return [next, { type: 'remove', id: step.node.id }]
    }
    case 'remove': {
      const place = map.get(step.id)
      if (!place) throw new Error(`[dou-ui] there is no node "${step.id}" in the form`)
      const parent = place.parent?.id ?? null
      const next = withChildren(document, parent, (children) => {
        children.splice(place.index, 1)
        return children
      })
      return [next, { type: 'insert', node: place.node, parent, index: place.index }]
    }
    case 'update': {
      const place = map.get(step.id)
      if (!place) throw new Error(`[dou-ui] there is no node "${step.id}" in the form`)
      const back = previous(place.node, step.patch)
      return [
        replaceNode(document, step.id, patched(place.node, step.patch)),
        { type: 'update', id: step.id, patch: back },
      ]
    }
    case 'move': {
      const place = map.get(step.id)
      if (!place) throw new Error(`[dou-ui] there is no node "${step.id}" in the form`)
      if (step.parent !== null) {
        // A node cannot go inside itself.
        let up: FormNodePlace | undefined = map.get(step.parent)
        while (up) {
          if (up.node.id === step.id)
            throw new Error(`[dou-ui] the node "${step.id}" cannot move inside itself`)
          up = up.parent ? map.get(up.parent.id) : undefined
        }
      }
      const from = place.parent?.id ?? null
      const removed = withChildren(document, from, (children) => {
        children.splice(place.index, 1)
        return children
      })
      const next = withChildren(removed, step.parent, (children) => {
        children.splice(clampIndex(step.index, children.length), 0, place.node)
        return children
      })
      return [next, { type: 'move', id: step.id, parent: from, index: place.index }]
    }
    case 'updateDocument': {
      const record = document as unknown as Record<string, unknown>
      const next: Record<string, unknown> = { ...document }
      const back: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(step.patch)) {
        if (key === 'nodes' || key === 'version') continue
        back[key] = record[key]
        if (value === undefined) delete next[key]
        else next[key] = value
      }
      return [next as unknown as FormDocument, { type: 'updateDocument', patch: back }]
    }
  }
}

const clampIndex = (index: number, length: number) =>
  Math.min(Math.max(0, Math.round(index)), length)

/**
 * Changes to a form document, made step by step. Each step returns a new
 * document that shares every node it did not touch with the one before,
 * so views of untouched nodes do not render again. The builder records
 * the steps for undo; extensions and code dispatch them through
 * `useFormBuilder().dispatch`.
 */
export class FormBuilderTransaction {
  /** The document after the steps so far. */
  doc: FormDocument
  readonly steps: FormBuilderStep[] = []
  /** The steps that undo the ones so far, last one first. */
  readonly inverse: FormBuilderStep[] = []
  readonly meta: FormBuilderTransactionMeta = {}

  constructor(
    /** The document the transaction starts from. */
    readonly before: FormDocument,
  ) {
    this.doc = before
  }

  /** Whether any step was made. */
  get changed() {
    return this.steps.length > 0
  }

  /** Apply a step as it is. */
  step(step: FormBuilderStep) {
    const [doc, inverse] = applyStep(this.doc, step)
    this.doc = doc
    this.steps.push(step)
    this.inverse.unshift(inverse)
    return this
  }

  /** Put a node, and what it holds, into a container (`null`: the top), at `index` (the end by default). */
  insert(node: FormNode, parent: string | null = null, index = Infinity) {
    return this.step({ type: 'insert', node, parent, index })
  }

  /** Take a node, and what it holds, out of the document. */
  remove(id: string) {
    return this.step({ type: 'remove', id })
  }

  /** Set keys of a node; `undefined` removes a key. */
  update(id: string, patch: FormNodePatch) {
    return this.step({ type: 'update', id, patch })
  }

  /** Move a node into a container (`null`: the top), at `index` of the list without it. */
  move(id: string, parent: string | null, index: number) {
    return this.step({ type: 'move', id, parent, index })
  }

  /** Change the settings of the document, e.g. `{ layout: 'horizontal' }`. */
  updateDocument(patch: FormDocumentPatch) {
    return this.step({ type: 'updateDocument', patch })
  }

  setMeta(key: string, value: unknown) {
    this.meta[key] = value
    return this
  }
}

/** Run steps on a document, e.g. ones from undo or from another person. */
export function applyFormSteps(document: FormDocument, steps: readonly FormBuilderStep[]) {
  const tr = new FormBuilderTransaction(document)
  for (const step of steps) tr.step(step)
  return tr
}

/** Merge updates of the same node that follow each other, for steps kept by undo. */
export function compactFormSteps(steps: readonly FormBuilderStep[]): FormBuilderStep[] {
  const result: FormBuilderStep[] = []
  for (const step of steps) {
    const last = result[result.length - 1]
    if (last?.type === 'update' && step.type === 'update' && last.id === step.id)
      result[result.length - 1] = { ...last, patch: { ...last.patch, ...step.patch } }
    else if (last?.type === 'updateDocument' && step.type === 'updateDocument')
      result[result.length - 1] = { ...last, patch: { ...last.patch, ...step.patch } }
    else result.push(step)
  }
  return result
}
