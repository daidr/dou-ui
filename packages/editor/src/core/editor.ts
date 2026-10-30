import { baseKeymap } from 'prosemirror-commands'
import { history } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import type { Node as PMNode } from 'prosemirror-model'
import { EditorState, type Command, type Plugin } from 'prosemirror-state'
import { EditorView, type NodeViewConstructor } from 'prosemirror-view'
import { blockSelectionPlugin } from './block-selection'
import type { ResolvedExtensions } from './extension'
import { editorInputRules } from './input-rules'
import { editorKeymap, type KeymapOptions } from './keymap'
import { blocksToDoc, docToBlocks, type Block, type PartialBlock } from './model'
import { idPlugin, placeholderPlugin, type PlaceholderOptions } from './plugins'

export interface CreateEditorOptions {
  /** Where the editor goes. */
  element: HTMLElement
  /** The resolved extensions: schema, plugins, node views. */
  kit: ResolvedExtensions
  /** More node views, e.g. ones that render Vue components. */
  nodeViews?: Record<string, NodeViewConstructor>
  blocks?: PartialBlock[]
  editable?: boolean
  placeholder: PlaceholderOptions
  /** Called after each change to the document. */
  onChange?: (view: EditorView) => void
  /** Called after every state change, including the selection. */
  onUpdate?: (view: EditorView) => void
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

export function createPlugins(options: Omit<CreateEditorOptions, 'element'>): Plugin[] {
  const { kit } = options
  const provider = kit.history
  const builtInHistory = options.history !== false && !provider
  return [
    ...(options.plugins ?? []),
    ...kit.plugins,
    editorInputRules(kit.inputRules),
    blockSelectionPlugin(),
    ...kit.keymaps.map((bindings) => keymap(bindings)),
    editorKeymap({
      undo: options.undo ?? provider?.undo,
      redo: options.redo ?? provider?.redo,
    }),
    keymap(baseKeymap),
    ...(provider?.plugins ?? []),
    ...(builtInHistory ? [history()] : []),
    idPlugin(),
    placeholderPlugin(options.placeholder),
  ]
}

export function createState(
  kit: ResolvedExtensions,
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
      const next = this.state.apply(tr)
      this.updateState(next)
      if (tr.docChanged) options.onChange?.(this)
      options.onUpdate?.(this)
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
  view.dispatch(tr)
}

export function getBlocks(view: EditorView): Block[] {
  return docToBlocks(view.state.doc)
}

export function runCommand(view: EditorView, command: Command): boolean {
  return command(view.state, view.dispatch, view)
}

export type { PMNode }
