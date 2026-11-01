import { baseKeymap } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import type { Node as PMNode } from 'prosemirror-model'
import { EditorState, Plugin, PluginKey, type Command, type Transaction } from 'prosemirror-state'
import { EditorView, type NodeViewConstructor } from 'prosemirror-view'
import { blockSelectionPlugin } from './block-selection'
import type { ResolvedEditorExtensions } from './extension'
import { editorInputRules } from './input-rules'
import { editorKeymap, type KeymapOptions } from './keymap'
import { blocksToDoc, docToBlocks, type Block, type PartialBlock } from './model'
import { idPlugin, placeholderPlugin, type PlaceholderOptions } from './plugins'
import { preparePastePlugin } from './prepare'

export interface CreateEditorOptions {
  /** Where the editor goes. */
  element: HTMLElement
  /** The resolved extensions: schema, plugins, node views. */
  kit: ResolvedEditorExtensions
  /** More node views, e.g. ones that render Vue components. */
  nodeViews?: Record<string, NodeViewConstructor>
  blocks?: PartialBlock[]
  editable?: boolean
  placeholder: PlaceholderOptions
  /** Called after each change to the document, with the transaction and the state before it. */
  onChange?: (view: EditorView, tr: Transaction, before: EditorState) => void
  /** Called after every state change, including the selection. */
  onUpdate?: (view: EditorView, before: EditorState) => void
  /**
   * Extra plugins, placed before the built-in ones so their keys win.
   * The collaboration extension adds its sync and cursor plugins here.
   */
  plugins?: Plugin[]
  /** Leave out the built-in undo history (collaboration brings its own). */
  history?: boolean
  undo?: KeymapOptions['undo']
  redo?: KeymapOptions['redo']
  /** Attributes for the editable element, e.g. an accessible name. */
  attributes?: () => Record<string, string>
}

/** The transaction meta that names who made a change, for the `transaction` event. */
export const originKey = 'douOrigin'

const historyKey = new PluginKey<{ undo: Command; redo: Command }>('douHistory')

/**
 * The undo and redo the editor runs: the built-in history's, or those of
 * the extension or props that replace it. For node views that edit their
 * text themselves, so their undo is the document's.
 */
export function historyCommands(state: EditorState): {
  undo: Command
  redo: Command
} {
  return historyKey.getState(state) ?? { undo, redo }
}

export function createPlugins(options: Omit<CreateEditorOptions, 'element'>): Plugin[] {
  const { kit } = options
  const provider = kit.history
  const builtInHistory = options.history !== false && !provider
  const commands = {
    undo: options.undo ?? provider?.undo ?? undo,
    redo: options.redo ?? provider?.redo ?? redo,
  }
  return [
    new Plugin({
      key: historyKey,
      state: { init: () => commands, apply: (_tr, value) => value },
    }),
    ...(options.plugins ?? []),
    ...kit.plugins,
    editorInputRules(kit.inputRules),
    blockSelectionPlugin(),
    ...kit.keymaps.map((bindings) => keymap(bindings)),
    editorKeymap(commands),
    keymap(baseKeymap),
    ...(provider?.plugins ?? []),
    ...(builtInHistory ? [history()] : []),
    preparePastePlugin(kit),
    idPlugin(),
    placeholderPlugin(options.placeholder),
  ]
}

export function createState(
  kit: ResolvedEditorExtensions,
  blocks: PartialBlock[] | undefined,
  plugins: Plugin[],
): EditorState {
  return EditorState.create({
    schema: kit.schema,
    doc: blocksToDoc(kit.schema, blocks ?? []),
    plugins,
  })
}

const viewNodeViews = new WeakMap<EditorView, Record<string, NodeViewConstructor>>()

/** Fresh functions, so the view redraws every node view (e.g. after `editable` changes). */
const fresh = (nodeViews: Record<string, NodeViewConstructor>) =>
  Object.fromEntries(
    Object.entries(nodeViews).map(([name, create]) => [
      name,
      ((...args) => create(...args)) as NodeViewConstructor,
    ]),
  )

export function createEditorView(options: CreateEditorOptions): EditorView {
  const editable = options.editable ?? true
  const plugins = createPlugins(options)
  const nodeViews = { ...options.kit.nodeViews, ...options.nodeViews }
  const view: EditorView = new EditorView(options.element, {
    state: createState(options.kit, options.blocks, plugins),
    editable: () => editable,
    nodeViews: fresh(nodeViews),
    attributes: () => ({
      class: 'dou-editor__surface',
      role: 'textbox',
      'aria-multiline': 'true',
      ...options.attributes?.(),
    }),
    // `this`, not `view`: plugins (e.g. collaboration) dispatch while the view is being created
    dispatchTransaction(this: EditorView, tr) {
      const before = this.state
      const next = before.apply(tr)
      this.updateState(next)
      if (next.doc !== before.doc) options.onChange?.(this, tr, before)
      options.onUpdate?.(this, before)
    },
  })
  viewNodeViews.set(view, nodeViews)
  return view
}

export function setEditable(view: EditorView, value: boolean) {
  // node views draw controls (checkboxes…) that are disabled while read-only
  view.setProps({ editable: () => value, nodeViews: fresh(viewNodeViews.get(view) ?? {}) })
}

/** Replace the whole document, e.g. when `v-model` changes from outside. */
export function replaceBlocks(view: EditorView, blocks: PartialBlock[]) {
  const state = view.state
  const doc = blocksToDoc(state.schema, blocks)
  const tr = state.tr.replaceWith(0, state.doc.content.size, doc.content)
  tr.setMeta('addToHistory', false)
  tr.setMeta(originKey, 'external')
  view.dispatch(tr)
}

export function getBlocks(view: EditorView): Block[] {
  return docToBlocks(view.state.doc)
}

export function runCommand(view: EditorView, command: Command): boolean {
  return command(view.state, view.dispatch, view)
}

export type { PMNode }
