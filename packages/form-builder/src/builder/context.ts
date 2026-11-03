import { computed, inject, nextTick, shallowReactive, shallowRef, toRaw, watch } from 'vue'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import { matchesHotkey } from 'dou-ui'
import { isContainer, isPage } from '../core/document'
import type {
  FormContainerNode,
  FormDocument,
  FormNode,
  FormPageNode,
  FormValidator,
} from '../core/types'
import type { FormFunction } from '../core/expression'
import type { FormFieldType } from '../fields/define'
import type { FormOptionsLoader } from '../renderer/context'
import type { FormBuilderHistoryHandler, ResolvedFormBuilderExtensions } from './extension'
import { formatMessage } from '../locale'
import type { FormBuilderMessages } from './locale'
import { FormBuilderHistory } from './core/history'
import { FormBuilderTransaction, formNodePlaces } from './core/transaction'
import {
  createNode,
  duplicateNodes,
  insertPlace,
  moveNodes,
  moveNodesTo,
  namesIn,
  topmost,
  removeNodes,
  replaceDocument,
  scopeOf,
  wrapNodes,
} from './core/commands'
import type { FormBuilderInsertPlace } from './core/commands'
import { labelOf, nodeTitle } from './settings'
import type { DragController } from './drag'

/** What the builder shows: the canvas to edit on, or the form to fill in as people will. */
export type FormBuilderMode = 'design' | 'preview'

/** How a click changes the selection: replace it, add or take away the node, or extend it. */
export type FormBuilderSelectMode = 'replace' | 'toggle' | 'extend'

export interface FormBuilderDispatchOptions {
  /** The selection after the change. Defaults to the current one, without nodes that are gone. */
  selection?: readonly string[]
  /** Read out to screen readers once the change is made. */
  announce?: string
}

/**
 * What the builder and its parts share, from `useFormBuilder()` inside a
 * builder, e.g. in a panel of your own or a field type's component.
 */
export interface FormBuilderContext {
  /** The document as it is now. */
  readonly document: FormDocument
  /** The ids of the selected nodes, the last one selected last. */
  readonly selection: readonly string[]
  /** Every field type, built-in and given. */
  readonly fields: ReadonlyMap<string, FormFieldType>
  readonly messages: FormBuilderMessages
  readonly canUndo: boolean
  readonly canRedo: boolean
  /**
   * Whether the builder only shows the form: nodes can be selected and
   * their settings read, but the commands below change nothing. A
   * transaction handed to `dispatch` still applies.
   */
  readonly readonly: boolean
  readonly mode: FormBuilderMode
  /** Show the canvas or the preview. */
  setMode: (mode: FormBuilderMode) => void
  /** A transaction on the document as it is now, to `dispatch`. */
  transaction: () => FormBuilderTransaction
  /** Make the changes of a transaction, as one undo step (or part of one, by `meta.group`). */
  dispatch: (tr: FormBuilderTransaction, options?: FormBuilderDispatchOptions) => void
  /** Select nodes; `null` or `[]` selects the form itself. */
  select: (ids: string | readonly string[] | null, mode?: FormBuilderSelectMode) => void
  /**
   * Add a new node of a type (a field type or `section`, `tabs`, `steps`,
   * `list`) and select it. It goes into the selected container, else
   * after the selected node, else at the end, unless `place` says where.
   * Returns its id.
   */
  add: (type: string, place?: FormBuilderInsertPlace) => string | undefined
  /** Delete nodes, the selected ones by default. */
  remove: (ids?: readonly string[]) => void
  /** Put a copy of each node after it, the selected ones by default, and select the copies. */
  duplicate: (ids?: readonly string[]) => void
  /** Move nodes, the selected ones by default, one place up (`-1`) or down (`1`). */
  moveBy: (delta: -1 | 1, ids?: readonly string[]) => void
  /**
   * Move nodes, the selected ones by default, into a container (`null`:
   * the top) to start at `index` of its children as they are now.
   */
  moveTo: (place: FormBuilderInsertPlace, ids?: readonly string[]) => void
  /** Replace the whole form with another, e.g. one imported as JSON, as one undo step. */
  replace: (document: FormDocument) => void
  /** Put nodes of one container into a new section, the selected ones by default. */
  wrap: (ids?: readonly string[]) => void
  /** Add a page to tabs or steps (the selected ones, or the ones around the selection). */
  addPage: (id?: string) => void
  /** Select the container around the last selected node, or the form. */
  selectParent: () => void
  undo: () => void
  redo: () => void
  /** The page of tabs or steps the canvas shows. */
  shownPage: (container: FormContainerNode) => FormPageNode | undefined
}

/** What the builder's own parts read besides the public context. */
export interface BuilderState extends FormBuilderContext {
  /** The id of a node's element on the canvas or in the outline. */
  domId: (id: string, view: 'canvas' | 'outline') => string
  announce: (text: string) => void
  live: Ref<string>
  /** Keys pressed on the canvas or the outline; `order` is the nodes as they are listed there. */
  keydown: (event: KeyboardEvent, view: BuilderView) => void
  /** Ask the inspector to focus its first setting. */
  focusInspector: () => void
  inspector: Ref<HTMLElement | null>
  /** The canvas's focusable tree, to take focus back. */
  canvas: Ref<HTMLElement | null>
  /** Taps add to the selection or take from it, for touch screens without Shift or ⌘. */
  tapToggles: Ref<boolean>
  /**
   * A press on a node in a view: Shift selects the range from the last
   * plain press, ⌘ / Ctrl (or `tapToggles`) adds or removes, else replaces.
   */
  pick: (id: string, event: MouseEvent, view: BuilderView) => void
  /** Drags on the canvas, set by the canvas once it is mounted. */
  dragger: Ref<DragController | null>
  /** Opens the menu of the selected nodes at a point of the viewport, set by the canvas. */
  openMenu: Ref<((x: number, y: number) => void) | null>
  /** The names of the functions given to the builder, for checks and completions. */
  functionNames: ComputedRef<string[]>
  /** The functions given to the builder, for the preview. */
  functions: () => Record<string, FormFunction> | undefined
  sources: () => Record<string, FormOptionsLoader> | undefined
  /** The validators given to the builder, for the preview and the rules editor. */
  validators: () => Record<string, FormValidator> | undefined
  extensions: () => ResolvedFormBuilderExtensions
  /** The selection, as a set, for views checking many nodes. */
  selected: ComputedRef<ReadonlySet<string>>
  /** The node the inspector and the action bar are for: the last selected one. */
  focused: ComputedRef<FormNode | undefined>
}

/** A list of nodes as a view shows them, for the arrow keys. */
export interface BuilderView {
  name: 'canvas' | 'outline'
  /** The nodes in the order they are listed. */
  order: () => string[]
  /** `ArrowRight` on a node: return `true` when the view handled it, e.g. by expanding it. */
  expand?: (id: string) => boolean
  collapse?: (id: string) => boolean
}

export const builderKey: InjectionKey<BuilderState> = Symbol('DouFormBuilder')

/** Inside a builder: its document, selection and commands. */
export function useFormBuilder(): FormBuilderContext {
  const state = inject(builderKey, undefined)
  if (!state)
    throw new Error(
      '[@dou-ui/form-builder] useFormBuilder() must be called inside <DouFormBuilder>',
    )
  return state
}

export function useBuilderState(): BuilderState {
  const state = inject(builderKey, undefined)
  if (!state)
    throw new Error(
      '[@dou-ui/form-builder] the parts of a form builder must be placed inside <DouFormBuilder>',
    )
  return state
}

export interface CreateBuilderOptions {
  uid: string
  document: () => FormDocument
  selection: () => readonly string[] | undefined
  fields: () => Map<string, FormFieldType>
  messages: () => FormBuilderMessages
  emitDocument: (document: FormDocument, tr: FormBuilderTransaction) => void
  emitSelection: (ids: string[]) => void
  mode: () => FormBuilderMode
  emitMode: (mode: FormBuilderMode) => void
  functions: () => Record<string, FormFunction> | undefined
  sources: () => Record<string, FormOptionsLoader> | undefined
  validators: () => Record<string, FormValidator> | undefined
  readonly: () => boolean
  extensions: () => ResolvedFormBuilderExtensions
}

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index])

export function createBuilderState(options: CreateBuilderOptions): BuilderState {
  const doc = shallowRef<FormDocument>(toRaw(options.document()))
  const selection = shallowRef<readonly string[]>(options.selection() ?? [])
  const history = new FormBuilderHistory()
  /** Bumped whenever the history changes, so `canUndo` and `canRedo` stay current. */
  const travelled = shallowRef(0)
  const live = shallowRef('')
  const inspector = shallowRef<HTMLElement | null>(null)
  const canvas = shallowRef<HTMLElement | null>(null)
  const dragger = shallowRef<DragController | null>(null)
  const openMenu = shallowRef<((x: number, y: number) => void) | null>(null)

  // A document from outside, e.g. one loaded or reset by the page, starts a new history.
  watch(options.document, (next) => {
    const raw = toRaw(next)
    if (raw === doc.value) return
    doc.value = raw
    history.clear()
    travelled.value++
    setSelection(selection.value)
  })
  watch(options.selection, (next) => {
    if (next && !same(next, selection.value)) setSelection(next, false)
  })

  function setSelection(ids: readonly string[], emit = true) {
    const map = formNodePlaces(doc.value)
    const seen = new Set<string>()
    const next = ids.filter((id) => map.has(id) && !seen.has(id) && seen.add(id))
    if (same(next, selection.value)) return
    selection.value = next
    if (emit) options.emitSelection(next.slice())
  }

  // The page each tabs and steps shows: the one holding the selection, else the last one opened.
  const opened = shallowReactive(new Map<string, string>())
  watch(
    [selection, doc],
    ([ids, document]) => {
      const map = formNodePlaces(document)
      for (const id of ids) {
        let place = map.get(id)
        while (place) {
          const parent = place.parent
          if (parent && isPage(place.node) && opened.get(parent.id) !== place.node.id)
            opened.set(parent.id, place.node.id)
          place = parent ? map.get(parent.id) : undefined
        }
      }
    },
    { immediate: true },
  )
  function shownPage(container: FormContainerNode) {
    const pages = container.children as FormNode[]
    const id = opened.get(container.id)
    return (pages.find((page) => page.id === id) ?? pages[0]) as FormPageNode | undefined
  }

  const selected = computed(() => new Set(selection.value))
  const focused = computed(() => {
    const last = selection.value[selection.value.length - 1]
    return last ? formNodePlaces(doc.value).get(last)?.node : undefined
  })

  function announce(text: string) {
    live.value = ''
    void nextTick(() => (live.value = text))
  }

  function transaction() {
    return new FormBuilderTransaction(doc.value)
  }

  /** An extension's history, used instead of the builder's own. */
  let customFor: unknown
  let custom: FormBuilderHistoryHandler | null = null
  function customHistory() {
    const make = options.extensions().history
    if (make !== customFor) {
      customFor = make
      custom = make ? make(self) : null
    }
    return custom
  }

  function dispatch(tr: FormBuilderTransaction, dispatchOptions: FormBuilderDispatchOptions = {}) {
    if (tr.before !== doc.value)
      throw new Error(
        '[@dou-ui/form-builder] the transaction was made on another version of the form',
      )
    const before = selection.value.slice()
    if (tr.changed) for (const hook of options.extensions().transactions) hook(tr, self)
    if (tr.changed) {
      doc.value = tr.doc
      options.emitDocument(tr.doc, tr)
    }
    setSelection(dispatchOptions.selection ?? selection.value)
    if (tr.changed) {
      if (!customHistory()) history.record(tr, before, selection.value.slice())
      travelled.value++
    }
    if (dispatchOptions.announce) announce(dispatchOptions.announce)
  }

  function select(ids: string | readonly string[] | null, mode: FormBuilderSelectMode = 'replace') {
    const list = ids === null ? [] : typeof ids === 'string' ? [ids] : ids
    if (mode === 'replace') return setSelection(list)
    const current = selection.value
    if (mode === 'toggle') {
      const off = new Set(list.filter((id) => current.includes(id)))
      return setSelection([
        ...current.filter((id) => !off.has(id)),
        ...list.filter((id) => !off.has(id)),
      ])
    }
    setSelection([...current.filter((id) => !list.includes(id)), ...list])
  }

  const tapToggles = shallowRef(false)
  /** Where a Shift range starts: the node of the last press without Shift. */
  let anchor: string | undefined
  function pick(id: string, event: MouseEvent, view: BuilderView) {
    if (event.metaKey || event.ctrlKey || tapToggles.value) {
      anchor = id
      return select(id, 'toggle')
    }
    const from = anchor && selection.value.includes(anchor) ? anchor : undefined
    if (event.shiftKey && from) {
      const order = view.order()
      const a = order.indexOf(from)
      const b = order.indexOf(id)
      if (a >= 0 && b >= 0) {
        // From the start of the range to the pressed node, which goes last for the inspector.
        const range: string[] = []
        const dir = a <= b ? 1 : -1
        for (let at = a; at !== b + dir; at += dir) range.push(order[at]!)
        return setSelection(range)
      }
    }
    anchor = id
    select(id, 'replace')
  }

  const context = () => ({ fields: options.fields(), messages: options.messages() })
  const target = (ids?: readonly string[]) => ids ?? selection.value

  const locked = () => options.readonly()

  function add(type: string, place?: FormBuilderInsertPlace) {
    if (locked()) return undefined
    const document = doc.value
    const where = place ?? insertPlace(document, selection.value, type, shownPage)
    const node = createNode(type, {
      ...context(),
      taken: namesIn(document, scopeOf(document, where.parent)),
    })
    const tr = transaction().insert(node, where.parent, where.index)
    tr.setMeta('origin', 'insert')
    const label = labelOf(type, options.fields().get(type), options.messages())
    dispatch(tr, {
      selection: [node.id],
      announce: formatMessage(options.messages().announce.inserted, { label }),
    })
    return node.id
  }

  function remove(ids?: readonly string[]) {
    if (locked()) return
    const tr = transaction()
    const { removed, next } = removeNodes(tr, target(ids))
    if (!removed) return
    dispatch(tr, {
      selection: next ? [next] : [],
      announce: formatMessage(options.messages().announce.removed, { count: removed }),
    })
  }

  function duplicate(ids?: readonly string[]) {
    if (locked()) return
    const tr = transaction()
    const copies = duplicateNodes(tr, target(ids))
    if (!copies.length) return
    dispatch(tr, {
      selection: copies,
      announce: formatMessage(options.messages().announce.duplicated, { count: copies.length }),
    })
  }

  function moveBy(delta: -1 | 1, ids?: readonly string[]) {
    if (locked()) return
    const tr = transaction()
    if (!moveNodes(tr, target(ids), delta)) return
    const last = target(ids)[target(ids).length - 1]
    const place = last ? formNodePlaces(tr.doc).get(last) : undefined
    dispatch(tr, {
      announce: place
        ? formatMessage(options.messages().announce.moved, { index: place.index + 1 })
        : undefined,
    })
  }

  function moveTo(place: FormBuilderInsertPlace, ids?: readonly string[]) {
    if (locked()) return
    const tr = transaction()
    const moving = target(ids)
    if (!moveNodesTo(tr, moving, place.parent, place.index)) return
    tr.setMeta('origin', 'drag')
    const map = formNodePlaces(tr.doc)
    const moved = topmost(tr.doc, moving)
    const first = map.get(moved[0] ?? '')
    const messages = options.messages()
    const where = first?.parent
      ? nodeTitle(first.parent, options.fields(), messages)
      : messages.drag.top
    dispatch(tr, {
      selection: [...moving],
      announce: first
        ? formatMessage(
            moved.length > 1 ? messages.announce.movedManyTo : messages.announce.movedTo,
            {
              where,
              index: first.index + 1,
              count: moved.length,
            },
          )
        : undefined,
    })
  }

  function replace(next: FormDocument) {
    if (locked()) return
    const tr = transaction()
    replaceDocument(tr, toRaw(next))
    tr.setMeta('origin', 'replace')
    dispatch(tr, { selection: [], announce: options.messages().announce.replaced })
  }

  function wrap(ids?: readonly string[]) {
    if (locked()) return
    const tr = transaction()
    const section = wrapNodes(tr, target(ids), context())
    if (!section) return
    dispatch(tr, { selection: [section], announce: options.messages().announce.wrapped })
  }

  function addPage(id?: string) {
    if (locked()) return
    const map = formNodePlaces(doc.value)
    let place = map.get(id ?? selection.value[selection.value.length - 1] ?? '')
    while (place && place.node.type !== 'tabs' && place.node.type !== 'steps')
      place = place.parent ? map.get(place.parent.id) : undefined
    if (!place) return
    const container = place.node as FormContainerNode
    const messages = options.messages()
    const text = container.type === 'steps' ? messages.created.step : messages.created.page
    const page = createNode('page', { ...context(), taken: new Set() }) as FormPageNode
    page.title = formatMessage(text, { index: container.children.length + 1 })
    const tr = transaction().insert(page, container.id, container.children.length)
    dispatch(tr, {
      selection: [page.id],
      announce: formatMessage(messages.announce.inserted, { label: page.title }),
    })
  }

  function parentOf(id: string | undefined) {
    if (!id) return undefined
    return formNodePlaces(doc.value).get(id)?.parent ?? undefined
  }

  function selectParent() {
    const last = selection.value[selection.value.length - 1]
    const parent = parentOf(last)
    setSelection(parent ? [parent.id] : [])
  }

  function travel(direction: 'undo' | 'redo') {
    if (locked()) return
    const handler = customHistory()
    if (handler) {
      if (!handler[direction]()) return
      travelled.value++
      announce(options.messages().announce[direction === 'undo' ? 'undone' : 'redone'])
      return
    }
    const result = direction === 'undo' ? history.undo(doc.value) : history.redo(doc.value)
    if (!result) return
    doc.value = result.tr.doc
    options.emitDocument(result.tr.doc, result.tr)
    setSelection(result.selection)
    travelled.value++
    announce(options.messages().announce[direction === 'undo' ? 'undone' : 'redone'])
  }

  function focusInspector() {
    const root = inspector.value
    const first = root?.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]',
    )
    first?.focus()
  }

  /** The keys of the canvas and the outline, as hotkeys. */
  const keys: [
    hotkey: string,
    run: (view: BuilderView, event: KeyboardEvent) => void,
    /** Changes the form, so a read-only builder lets the key through. */
    edits?: boolean,
  ][] = [
    ['mod+z', () => travel('undo'), true],
    ['mod+shift+z', () => travel('redo'), true],
    ['mod+y', () => travel('redo'), true],
    ['mod+d', () => duplicate(), true],
    ['mod+g', () => wrap(), true],
    ['delete', () => remove(), true],
    ['backspace', () => remove(), true],
    ['mod+arrowup', () => moveBy(-1), true],
    ['mod+arrowdown', () => moveBy(1), true],
    ['arrowup', (view) => step(view, -1, false)],
    ['arrowdown', (view) => step(view, 1, false)],
    ['shift+arrowup', (view) => step(view, -1, true)],
    ['shift+arrowdown', (view) => step(view, 1, true)],
    ['home', (view) => jump(view, 0)],
    ['end', (view) => jump(view, -1)],
    ['arrowright', (view) => inward(view)],
    ['arrowleft', (view) => outward(view)],
    ['enter', () => focusInspector()],
    ['escape', () => selectParent()],
  ]

  function step(view: BuilderView, delta: -1 | 1, extend: boolean) {
    const order = view.order()
    if (!order.length) return
    const last = selection.value[selection.value.length - 1]
    const at = last ? order.indexOf(last) : -1
    const next =
      at < 0
        ? order[delta > 0 ? 0 : order.length - 1]!
        : order[Math.min(Math.max(at + delta, 0), order.length - 1)]!
    if (!extend) return setSelection([next])
    // Shift + arrows grow the selection, or shrink it when going back over it.
    const before = selection.value[selection.value.length - 2]
    if (before === next) return setSelection(selection.value.slice(0, -1))
    select(next, 'extend')
  }

  function jump(view: BuilderView, at: 0 | -1) {
    const order = view.order()
    const id = at === 0 ? order[0] : order[order.length - 1]
    if (id) setSelection([id])
  }

  function inward(view: BuilderView) {
    const last = selection.value[selection.value.length - 1]
    if (!last || view.expand?.(last)) return
    const node = formNodePlaces(doc.value).get(last)?.node
    if (!node || !isContainer(node)) return
    const first = node.children[0]
    if (!first) return
    const order = view.order()
    if (order.includes(first.id)) setSelection([first.id])
  }

  function outward(view: BuilderView) {
    const last = selection.value[selection.value.length - 1]
    if (!last || view.collapse?.(last)) return
    const parent = parentOf(last)
    if (parent) setSelection([parent.id])
  }

  function keydown(event: KeyboardEvent, view: BuilderView) {
    if (event.isComposing) return
    // While nodes are picked up, the keys choose where they go.
    if (dragger.value?.carrying) {
      if (dragger.value.keydown(event)) event.preventDefault()
      return
    }
    if (event.key === ' ' && !event.repeat && !locked() && dragger.value?.pickUp()) {
      event.preventDefault()
      return
    }
    for (const keymap of options.extensions().keymaps)
      for (const [hotkey, handler] of Object.entries(keymap(self))) {
        if (!matchesHotkey(event, hotkey) || handler(event) === false) continue
        event.preventDefault()
        return
      }
    for (const [hotkey, run, edits] of keys) {
      if (!matchesHotkey(event, hotkey) || (edits && locked())) continue
      event.preventDefault()
      run(view, event)
      return
    }
  }

  const functionNames = computed(() => Object.keys(options.functions() ?? {}))

  const self: BuilderState = {
    get document() {
      return doc.value
    },
    get selection() {
      return selection.value
    },
    get fields() {
      return options.fields()
    },
    get messages() {
      return options.messages()
    },
    get canUndo() {
      void travelled.value
      return !locked() && (customHistory()?.canUndo() ?? history.canUndo)
    },
    get canRedo() {
      void travelled.value
      return !locked() && (customHistory()?.canRedo() ?? history.canRedo)
    },
    get readonly() {
      return locked()
    },
    get mode() {
      return options.mode()
    },
    setMode: (mode) => {
      if (mode !== options.mode()) options.emitMode(mode)
    },
    transaction,
    dispatch,
    select,
    add,
    remove,
    duplicate,
    moveBy,
    moveTo,
    replace,
    wrap,
    addPage,
    selectParent,
    undo: () => travel('undo'),
    redo: () => travel('redo'),
    shownPage,
    domId: (id, view) => `${options.uid}-${view === 'canvas' ? 'n' : 'o'}-${id}`,
    announce,
    live,
    keydown,
    focusInspector,
    inspector,
    canvas,
    dragger,
    openMenu,
    tapToggles,
    pick,
    selected,
    focused,
    functionNames,
    functions: options.functions,
    sources: options.sources,
    validators: options.validators,
    extensions: options.extensions,
  }
  return self
}

/** Every node in the order the canvas lists them: only the shown page of tabs and steps is open. */
export function canvasOrder(state: BuilderState): string[] {
  const order: string[] = []
  const visit = (nodes: readonly FormNode[]) => {
    for (const node of nodes) {
      order.push(node.id)
      if (node.type === 'tabs' || node.type === 'steps') {
        const container = node as FormContainerNode
        const shown = state.shownPage(container)
        for (const page of container.children) {
          order.push(page.id)
          if (page === shown) visit((page as FormPageNode).children)
        }
      } else if (isContainer(node)) visit(node.children)
    }
  }
  visit(state.document.nodes)
  return order
}
