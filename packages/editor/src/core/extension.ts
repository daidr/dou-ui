import type { InputRule } from 'prosemirror-inputrules'
import type { MarkSpec, NodeSpec, Schema } from 'prosemirror-model'
import type { Command, Plugin } from 'prosemirror-state'
import type { NodeViewConstructor } from 'prosemirror-view'
import type { Component } from 'vue'
import type { EditorMessages } from '../locale'
import type { BlockProps } from './model'
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
}

/** A toggle in the formatting toolbar for a mark. */
export interface FormatOption {
  mark: string
  label: Label
  icon: Component
  /** The shortcut shown in its tooltip, written as in `useHotkey`, e.g. `mod+b`. */
  hotkey?: string
}

export interface ExtensionContext {
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
 * The built-in blocks are extensions too (see `starterKit`).
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
  /** Inline nodes, e.g. a mention. */
  inlines?: Record<string, NodeSpec>
  marks?: Record<string, MarkSpec>
  nodeViews?: Record<string, NodeViewConstructor>
  inputRules?: (context: ExtensionContext) => InputRule[]
  keymap?: (context: ExtensionContext) => Record<string, Command>
  plugins?: (context: ExtensionContext) => Plugin[]
  /**
   * The document lives outside the editor (e.g. in a Yjs document): the
   * initial `modelValue` and later outside changes to it are ignored, and
   * `v-model` only mirrors the document.
   */
  externalDocument?: boolean
  /** Replace the built-in undo history. Only one extension may. */
  history?: (context: ExtensionContext) => HistoryProvider
  /** Entries for the slash menu and the “turn into” menus. */
  blockOptions?: BlockOption[]
  /** Toggles for the formatting toolbar. */
  formats?: FormatOption[]
}

/** Declare an extension; only gives it a type. */
export function defineExtension(extension: EditorExtension): EditorExtension {
  return extension
}

/** Everything the extensions contribute, gathered once per list of extensions. */
export interface ResolvedExtensions {
  extensions: EditorExtension[]
  schema: Schema
  context: ExtensionContext
  nodeViews: Record<string, NodeViewConstructor>
  blockOptions: BlockOption[]
  formats: FormatOption[]
  inputRules: InputRule[]
  keymaps: Record<string, Command>[]
  plugins: Plugin[]
  history: HistoryProvider | null
  externalDocument: boolean
}

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
export function resolveExtensions(
  list: readonly (EditorExtension | EditorExtension[])[],
): ResolvedExtensions {
  const extensions = flatten(list)
    .map((extension, index) => ({ extension, index }))
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    .sort(
      (a, b) => (b.extension.priority ?? 100) - (a.extension.priority ?? 100) || a.index - b.index,
    )
    .map((entry) => entry.extension)

  const names = new Set<string>()
  const blocks: Record<string, NodeSpec> = {}
  const inlines: Record<string, NodeSpec> = {}
  const marks: Record<string, MarkSpec> = {}
  for (const extension of extensions) {
    if (names.has(extension.name))
      throw new Error(`[@dou-ui/editor] the extension "${extension.name}" is added twice`)
    names.add(extension.name)
    merge(blocks, extension.blocks, 'block type', extension.name)
    merge(inlines, extension.inlines, 'inline node', extension.name)
    merge(marks, extension.marks, 'mark', extension.name)
  }
  const schema = createSchema({ blocks, inlines, marks })
  const context: ExtensionContext = { schema }

  const providers = extensions.filter((extension) => extension.history)
  if (providers.length > 1)
    throw new Error('[@dou-ui/editor] only one extension may replace the undo history')

  return {
    extensions,
    schema,
    context,
    nodeViews: Object.assign({}, ...extensions.map((extension) => extension.nodeViews ?? {})),
    blockOptions: extensions.flatMap((extension) => extension.blockOptions ?? []),
    formats: extensions.flatMap((extension) => extension.formats ?? []),
    inputRules: extensions.flatMap((extension) => extension.inputRules?.(context) ?? []),
    keymaps: extensions.flatMap((extension) =>
      extension.keymap ? [extension.keymap(context)] : [],
    ),
    plugins: extensions.flatMap((extension) => extension.plugins?.(context) ?? []),
    history: providers[0]?.history?.(context) ?? null,
    externalDocument: extensions.some((extension) => extension.externalDocument),
  }
}
