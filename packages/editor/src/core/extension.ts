import type { InputRule } from 'prosemirror-inputrules'
import type { MarkSpec, NodeSpec, Schema } from 'prosemirror-model'
import type { Command, Plugin } from 'prosemirror-state'
import type { NodeViewConstructor } from 'prosemirror-view'
import { parseHotkey, type CommentAction, type CommentThread } from 'dou-ui'
import type { Component, Ref } from 'vue'
import type { EditorMessages } from '../locale'
import type { BlockProps } from './model'
import type { EditorExtensionOutput } from './output'
import { createSchema } from './schema'

/** Text shown in a menu: fixed, or read from the editor's messages so it follows the locale. */
export type Label = string | ((messages: EditorMessages) => string)

export const labelOf = (label: Label | undefined, messages: EditorMessages) =>
  typeof label === 'function' ? label(messages) : (label ?? '')

/** An entry of the slash menu and of the “turn into” menus. */
export interface BlockOption {
  /** Unique among the options. */
  key: string
  /** The block type it inserts or turns blocks into. */
  type: string
  props?: BlockProps
  label: Label
  /** A short description under the label in the slash menu. */
  hint?: Label
  icon: Component
  /** Extra words the slash menu matches, besides the label (pinyin works well). */
  keywords?: string[]
  /** The Markdown shortcut, shown as a hint. */
  shortcut?: string
  /**
   * Variants to pick from in a panel beside the option in the slash menu,
   * e.g. how many columns. Choosing the option itself inserts the first.
   */
  choices?: BlockOptionChoices
}

/** The variants of a slash menu option, picked in a panel beside it. */
export interface BlockOptionChoices {
  /** The panel's title, e.g. “Number of columns”. */
  title: Label
  /** Each variant: the props it inserts with (over the option's own) and its name. */
  items: { props: BlockProps; label: Label }[]
  /**
   * Draws the variants. It gets `items`, `active` (the index of the
   * highlighted one) and `messages`, and emits `hover` and `choose` with an
   * index. Without it, the panel lists their names.
   */
  component?: Component
}

/** A toggle in the formatting toolbar for a mark. */
export interface FormatOption {
  mark: string
  label: Label
  icon: Component
  /** The shortcut shown in its tooltip, written as in `useHotkey`, e.g. `mod+b`. */
  hotkey?: string
}

/** Where the comment threads live, when not in `v-model:comments`. */
export interface CommentsProvider {
  /** The threads, kept up to date. */
  threads: Readonly<Ref<readonly CommentThread[]>>
  /** Make a change this user asked for. */
  apply: (action: CommentAction) => void
}

export interface EditorExtensionContext {
  schema: Schema
}

/** What the extension replacing the undo history provides (e.g. collaboration). */
export interface HistoryProvider {
  plugins: Plugin[]
  undo: Command
  redo: Command
}

/**
 * A piece of the editor: block types, marks, behaviour and menu entries.
 * The built-in blocks are extensions too (see `editorKit`).
 */
export interface EditorExtension {
  name: string
  /** Higher runs first: its keys, input rules and plugins win. Defaults to 100. */
  priority?: number
  /**
   * Content node specs for new block types, by type name. They join the
   * `blockContent` group. Extra spec fields the editor reads:
   * `continues` (Enter continues the same type, like a list) and
   * `component` (a Vue component that renders the block).
   */
  blocks?: Record<string, NodeSpec>
  /**
   * Nodes that only live inside the extension's blocks, e.g. a table's
   * rows and cells. They join no group.
   */
  nodes?: Record<string, NodeSpec>
  /** Inline nodes, e.g. a mention. */
  inlines?: Record<string, NodeSpec>
  marks?: Record<string, MarkSpec>
  nodeViews?: Record<string, NodeViewConstructor>
  /**
   * Node views that draw Vue components, by node type. Each is made with
   * `mount`, which renders a component into an element inside the editor's
   * app, so it can call `useEditor()` and follows the ConfigProvider.
   */
  componentViews?: Record<string, (mount: MountComponent) => NodeViewConstructor>
  inputRules?: (context: EditorExtensionContext) => InputRule[]
  /**
   * Keys, written as in `useHotkey` (e.g. `mod+shift+h`, `shift+tab`,
   * `enter`), while the editor has focus. A command returning `false` lets
   * the key through to the next extension.
   */
  keymap?: (context: EditorExtensionContext) => Record<string, Command>
  plugins?: (context: EditorExtensionContext) => Plugin[]
  /**
   * The document lives outside the editor (e.g. in a Yjs document): the
   * initial `modelValue` and later outside changes to it are ignored, and
   * `v-model` only mirrors the document.
   */
  externalDocument?: boolean
  /** Replace the built-in undo history. Only one extension may. */
  history?: (context: EditorExtensionContext) => HistoryProvider
  /**
   * Keep the comment threads somewhere else than `v-model:comments`, e.g.
   * in a shared document. `v-model:comments` then only mirrors them.
   * Only one extension may.
   */
  comments?: (context: EditorExtensionContext) => CommentsProvider
  /** Entries for the slash menu and the “turn into” menus. */
  blockOptions?: BlockOption[]
  /** Toggles for the formatting toolbar. */
  formats?: FormatOption[]
  /**
   * Components rendered next to the editing area while it is editable,
   * e.g. a popup of suggestions. They can call `useEditor()`.
   */
  overlays?: Component[]
  /**
   * Controls added to the formatting toolbar, after the marks (e.g. a
   * color menu). They can call `useEditor()`.
   */
  toolbar?: Component[]
  /**
   * Entries added to the block menu of the handle, usually a
   * `DouDropdownSub` or `DouDropdownItem`s. Each gets the block the menu is
   * for as the `block` prop (a `Block`) and can call `useEditor()`.
   */
  blockMenu?: Component[]
  /**
   * How the extension's blocks, inline nodes and marks are written as HTML
   * and Markdown (`blocksToHTML`, `blocksToMarkdown`).
   */
  output?: EditorExtensionOutput
  /**
   * Rewrite HTML before it is read as blocks (when pasting, and in
   * `htmlToBlocks` and `markdownToBlocks`), e.g. turn a `<details>`
   * element into a toggle with its children. `blockElement` and
   * `splitContainer` help build the editor's markup.
   */
  prepareHTML?: (root: HTMLElement) => void
}

/**
 * Renders `component` into `element` with `props` (a reactive object stays
 * live), inside the editor's app. Returns a function that removes it.
 */
export type MountComponent = (
  component: Component,
  props: Record<string, unknown>,
  element: HTMLElement,
) => () => void

/** Declare an extension; only gives it a type. */
export function defineEditorExtension(extension: EditorExtension): EditorExtension {
  return extension
}

/** Everything the extensions contribute, gathered once per list of extensions. */
export interface ResolvedEditorExtensions {
  extensions: EditorExtension[]
  schema: Schema
  context: EditorExtensionContext
  nodeViews: Record<string, NodeViewConstructor>
  componentViews: Record<string, (mount: MountComponent) => NodeViewConstructor>
  blockOptions: BlockOption[]
  formats: FormatOption[]
  overlays: Component[]
  toolbar: Component[]
  blockMenu: Component[]
  inputRules: InputRule[]
  keymaps: Record<string, Command>[]
  plugins: Plugin[]
  history: HistoryProvider | null
  comments: CommentsProvider | null
  externalDocument: boolean
}

const PM_KEYS: Record<string, string> = {
  ' ': 'Space',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  pageup: 'PageUp',
  pagedown: 'PageDown',
}
const PM_MODIFIERS: Record<string, string> = {
  mod: 'Mod',
  ctrl: 'Ctrl',
  alt: 'Alt',
  meta: 'Meta',
  shift: 'Shift',
}

/** `mod+shift+h` → `Mod-Shift-h`, the way the ProseMirror keymap names keys. */
export function toEditorKey(hotkey: string): string {
  const steps = parseHotkey(hotkey)
  if (steps.length !== 1)
    throw new Error(`[@dou-ui/editor] key sequences aren't supported in a keymap: "${hotkey}"`)
  const keys = steps[0]!
  const modifiers = Object.keys(PM_MODIFIERS)
    .filter((name) => keys.includes(name))
    .map((name) => PM_MODIFIERS[name])
  const key = keys.find((name) => !(name in PM_MODIFIERS)) ?? ''
  const name = PM_KEYS[key] ?? (key.length > 1 ? key[0]!.toUpperCase() + key.slice(1) : key)
  return [...modifiers, name].join('-')
}

const toEditorKeymap = (bindings: Record<string, Command>) =>
  Object.fromEntries(Object.entries(bindings).map(([key, command]) => [toEditorKey(key), command]))

function flatten(list: readonly (EditorExtension | EditorExtension[])[]): EditorExtension[] {
  const result: EditorExtension[] = []
  for (const item of list) {
    if (Array.isArray(item)) result.push(...flatten(item))
    else result.push(item)
  }
  return result
}

function merge<T>(
  target: Record<string, T>,
  source: Record<string, T> | undefined,
  what: string,
  owner: string,
) {
  for (const [name, value] of Object.entries(source ?? {})) {
    if (name in target)
      throw new Error(`[@dou-ui/editor] ${what} "${name}" from "${owner}" is already defined`)
    target[name] = value
  }
}

/** Sort the extensions by priority, build the schema and collect what they add. */
export function resolveEditorExtensions(
  list: readonly (EditorExtension | EditorExtension[])[],
): ResolvedEditorExtensions {
  const extensions = flatten(list)
    .map((extension, index) => ({ extension, index }))
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    .sort(
      (a, b) => (b.extension.priority ?? 100) - (a.extension.priority ?? 100) || a.index - b.index,
    )
    .map((entry) => entry.extension)

  const names = new Set<string>()
  const blocks: Record<string, NodeSpec> = {}
  const nodes: Record<string, NodeSpec> = {}
  const inlines: Record<string, NodeSpec> = {}
  const marks: Record<string, MarkSpec> = {}
  for (const extension of extensions) {
    if (names.has(extension.name))
      throw new Error(`[@dou-ui/editor] the extension "${extension.name}" is added twice`)
    names.add(extension.name)
    merge(blocks, extension.blocks, 'block type', extension.name)
    merge(nodes, extension.nodes, 'node', extension.name)
    merge(inlines, extension.inlines, 'inline node', extension.name)
    merge(marks, extension.marks, 'mark', extension.name)
  }
  const schema = createSchema({ blocks, nodes, inlines, marks })
  const context: EditorExtensionContext = { schema }

  const providers = extensions.filter((extension) => extension.history)
  if (providers.length > 1)
    throw new Error('[@dou-ui/editor] only one extension may replace the undo history')

  const keepers = extensions.filter((extension) => extension.comments)
  if (keepers.length > 1)
    throw new Error('[@dou-ui/editor] only one extension may keep the comment threads')

  return {
    extensions,
    schema,
    context,
    nodeViews: Object.assign({}, ...extensions.map((extension) => extension.nodeViews ?? {})),
    componentViews: Object.assign(
      {},
      ...extensions.map((extension) => extension.componentViews ?? {}),
    ),
    blockOptions: extensions.flatMap((extension) => extension.blockOptions ?? []),
    formats: extensions.flatMap((extension) => extension.formats ?? []),
    overlays: extensions.flatMap((extension) => extension.overlays ?? []),
    toolbar: extensions.flatMap((extension) => extension.toolbar ?? []),
    blockMenu: extensions.flatMap((extension) => extension.blockMenu ?? []),
    inputRules: extensions.flatMap((extension) => extension.inputRules?.(context) ?? []),
    keymaps: extensions.flatMap((extension) =>
      extension.keymap ? [toEditorKeymap(extension.keymap(context))] : [],
    ),
    plugins: extensions.flatMap((extension) => extension.plugins?.(context) ?? []),
    history: providers[0]?.history?.(context) ?? null,
    comments: keepers[0]?.comments?.(context) ?? null,
    externalDocument: extensions.some((extension) => extension.externalDocument),
  }
}
