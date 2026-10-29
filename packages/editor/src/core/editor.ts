import { baseKeymap } from 'prosemirror-commands'
import { history } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import type { Node as PMNode } from 'prosemirror-model'
import { EditorState, type Command, type Plugin } from 'prosemirror-state'
import { EditorView, type NodeViewConstructor } from 'prosemirror-view'
import { blockSelectionPlugin } from './block-selection'
import { clipboardPlugin } from './clipboard'
import { editorInputRules } from './input-rules'
import { editorKeymap, type KeymapOptions } from './keymap'
import { blocksToDoc, createId, docToBlocks, type Block, type PartialBlock } from './model'
import { idPlugin, numberingPlugin, placeholderPlugin, type PlaceholderOptions } from './plugins'
import { schema } from './schema'

const SVG = 'http://www.w3.org/2000/svg'

/** The check of `CheckIcon`, drawn at the checkbox's stroke width. */
function checkMark(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(SVG, 'path')
  path.setAttribute('d', 'm5 12.5 4.5 4.5L19 7.5')
  for (const [name, value] of Object.entries({
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }))
    path.setAttribute(name, value)
  svg.append(path)
  return svg
}

/** A to-do item: a real checkbox in front of the text, its state in the node's attributes. */
const checkItemView: NodeViewConstructor = (node, view, getPos) => {
  const dom = document.createElement('div')
  dom.className = 'dou-editor__content dou-editor__content--checkItem'
  dom.dataset.contentType = 'checkItem'
  const box = document.createElement('span')
  box.className = 'dou-editor__check'
  box.contentEditable = 'false'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'dou-editor__checkbox'
  button.setAttribute('role', 'checkbox')
  button.append(checkMark())
  box.append(button)
  const text = document.createElement('div')
  text.className = 'dou-editor__text'
  // the item's own text names the checkbox
  text.id = `dou-editor-check-${createId()}`
  button.setAttribute('aria-labelledby', text.id)
  dom.append(box, text)

  let current = node
  const sync = () => {
    const checked = !!current.attrs.checked
    dom.dataset.checked = String(checked)
    button.setAttribute('aria-checked', String(checked))
    button.disabled = !view.editable
  }
  sync()
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', () => {
    const pos = getPos()
    if (pos === undefined || !view.editable) return
    view.dispatch(view.state.tr.setNodeAttribute(pos, 'checked', !current.attrs.checked))
  })
  return {
    dom,
    contentDOM: text,
    update(next) {
      if (next.type !== current.type) return false
      current = next
      sync()
      return true
    },
    ignoreMutation: (mutation) => box.contains(mutation.target),
    stopEvent: (event) => box.contains(event.target as Node),
  }
}

export interface CreateEditorOptions {
  /** Where the editor goes. */
  element: HTMLElement
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

export function createPlugins(options: CreateEditorOptions): Plugin[] {
  return [
    ...(options.plugins ?? []),
    editorInputRules(schema),
    blockSelectionPlugin(),
    clipboardPlugin(),
    editorKeymap(schema, { undo: options.undo, redo: options.redo }),
    keymap(baseKeymap),
    ...(options.history === false ? [] : [history()]),
    idPlugin(),
    numberingPlugin(),
    placeholderPlugin(options.placeholder),
  ]
}

export function createState(blocks: PartialBlock[] | undefined, plugins: Plugin[]): EditorState {
  return EditorState.create({ schema, doc: blocksToDoc(schema, blocks ?? []), plugins })
}

export function createEditorView(options: CreateEditorOptions): EditorView {
  const editable = options.editable ?? true
  const plugins = createPlugins(options)
  const view: EditorView = new EditorView(options.element, {
    state: createState(options.blocks, plugins),
    editable: () => editable,
    nodeViews: { checkItem: checkItemView },
    attributes: () => ({
      class: 'dou-editor__surface',
      role: 'textbox',
      'aria-multiline': 'true',
      ...options.attributes?.(),
    }),
    dispatchTransaction(tr) {
      const next = view.state.apply(tr)
      view.updateState(next)
      if (tr.docChanged) options.onChange?.(view)
      options.onUpdate?.(view)
    },
  })
  return view
}

export function setEditable(view: EditorView, value: boolean) {
  // a new node view function redraws the checkboxes, which are disabled while read-only
  view.setProps({
    editable: () => value,
    nodeViews: { checkItem: (...args) => checkItemView(...args) },
  })
}

/** Replace the whole document, e.g. when `v-model` changes from outside. */
export function replaceBlocks(view: EditorView, blocks: PartialBlock[]) {
  const doc = blocksToDoc(schema, blocks)
  const state = view.state
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
