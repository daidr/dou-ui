import type { CommentAction, CommentThread } from 'dou-ui'
import type { Component, Ref } from 'vue'
import type { SheetContext } from '../context'
import type { SheetMenuContext, SheetMenuItem, SheetToolbarItem } from '../types'
import type { SheetCommand } from './commands'
import type { SheetExporter, SheetImporter } from './file'
import type { SheetFunction } from '../formula/functions'
import type { SheetCellType } from './cell-type'
import type { SheetClip } from './clipboard'
import type { SheetWorkbook } from './model'
import type { SheetTransaction } from './transaction'

/** What an extension's hooks receive; the same as `useSheet()`. */
export type SheetExtensionContext = SheetContext

/**
 * A key handler: return `false` to let the key through to the next handler
 * and the grid's own keys; anything else means it was handled.
 */
export type SheetKeyHandler = (event: KeyboardEvent) => boolean | void

/** An undo history used instead of the grid's own, e.g. one that only takes back this user's changes. */
export interface SheetHistoryHandler {
  /** `false` when there was nothing to undo. */
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
}

/** A change the grid has made, as an extension's `update` sees it. */
export interface SheetUpdate {
  /** The workbook before the change. */
  before: SheetWorkbook
  /** The workbook now. */
  doc: SheetWorkbook
  /**
   * The change: typing, commands, undo and redo, `transact` and other
   * people's changes. `transaction.meta.action` says what made it, and
   * other people's changes in collaboration have `meta.origin` `'remote'`.
   * `null` when a new workbook came in through `v-model`.
   */
  transaction: SheetTransaction | null
}

/** Where the comment threads live, when not in `v-model:comments`. */
export interface SheetCommentsProvider {
  /** The threads, kept up to date. */
  threads: Readonly<Ref<readonly CommentThread[]>>
  /** Make a change this user asked for. */
  apply: (action: CommentAction) => void
}

/**
 * A piece of the sheet: cell types, keys, menu items, panels drawn over
 * the grid, and a say in every change.
 */
export interface SheetExtension {
  name: string
  /** Higher runs first: its keys and hooks come before others. Defaults to 100. */
  priority?: number
  /** Cell types cells can name with `type`; one with a built-in name replaces it. */
  cellTypes?: SheetCellType[]
  /**
   * Functions formulas can call (see `defineSheetFunction`); one with a
   * built-in name replaces it.
   */
  functions?: SheetFunction[]
  /**
   * Commands, by name: things toolbar items, menu items and keys can refer
   * to. Start the names with the extension's, e.g. `xlsx.export`. A name the
   * sheet already has replaces that command only with `override: true`.
   */
  commands?: Record<string, SheetCommand>
  /**
   * Ways to write files, offered in the toolbar's export menu and by
   * `exportFile`. One with a built-in name (`csv`, `png`, `svg`) replaces it.
   */
  exporters?: SheetExporter[]
  /**
   * Ways to read files, for the toolbar's import button, `importFile` and
   * dropped files. They are asked before the built-in CSV one.
   */
  importers?: SheetImporter[]
  /**
   * Keys, written as in `useHotkey` (e.g. `mod+b`, `alt+arrowdown`), while the
   * grid has focus and no cell is being edited: a handler, or the name of a
   * command to run. They come before the grid's own.
   */
  keymap?: (context: SheetExtensionContext) => Record<string, SheetKeyHandler | string>
  /** Items for the right-click menu, put before the built-in ones. */
  contextMenu?: (context: SheetExtensionContext, menu: SheetMenuContext) => SheetMenuItem[]
  /**
   * Items for `DouSheetToolbar`: after the built-in tools, or where its
   * `tools` names them by `key`.
   */
  toolbar?: (context: SheetExtensionContext) => SheetToolbarItem[]
  /**
   * Components drawn over the grid, not scrolled with it, e.g. a panel or
   * marks placed with `cellRect`. They can call `useSheet()`.
   */
  overlays?: Component[]
  /**
   * Components drawn over the cells, kept out of the headers: `below`
   * under the grid's own marks, such as the copied range and formula
   * references, `above` over them; the editor stays on top. They place marks with
   * `useSheet()`'s `cellRect` and `rangeRect`, which follow the scroll, and
   * take no clicks.
   */
  layers?: { below?: Component[]; above?: Component[] }
  /**
   * Keeps the comment threads somewhere else than `v-model:comments`, e.g.
   * in a shared document; `v-model:comments` then only mirrors them. Only
   * one extension may.
   */
  comments?: (context: SheetExtensionContext) => SheetCommentsProvider
  /** Replaces the grid's undo history; the first extension that has one wins. */
  history?: (context: SheetExtensionContext) => SheetHistoryHandler
  /** Runs once the grid is mounted. Return a function to run when it unmounts. */
  setup?: (context: SheetExtensionContext) => void | (() => void)
  /**
   * Sees every change made in the grid or with `transact` before it is
   * applied, in priority order, and may add steps to it. Undo takes back
   * the added steps with the rest.
   */
  transaction?: (tr: SheetTransaction, context: SheetExtensionContext) => void
  /**
   * Runs after every change, with the workbook already updated: changes in
   * the grid, `transact`, undo and redo, other people's changes and a new
   * `v-model` workbook. For keeping something else in step, such as a save
   * reminder; to change the change itself use `transaction`.
   */
  update?: (update: SheetUpdate, context: SheetExtensionContext) => void
  /**
   * Rewrites cells before they are pasted, or imported at the active cell,
   * in priority order; return `null` to stop it. A paste's `paste` event
   * comes after, with what the extensions made of it; an import has none.
   * Cut cells that come back rewritten still leave their place, in the
   * same step, but formulas pointing at them don't follow.
   */
  transformPaste?: (clip: SheetClip, context: SheetExtensionContext) => SheetClip | null
}

/** Declares an extension; only gives it a type. */
export function defineSheetExtension(extension: SheetExtension): SheetExtension {
  return extension
}

/** Everything the extensions contribute, gathered once per list. */
export interface ResolvedSheetExtensions {
  extensions: SheetExtension[]
  cellTypes: SheetCellType[]
  functions: SheetFunction[]
  commands: { extension: string; commands: Record<string, SheetCommand> }[]
  exporters: { extension: string; exporter: SheetExporter }[]
  importers: { extension: string; importer: SheetImporter }[]
  keymaps: NonNullable<SheetExtension['keymap']>[]
  toolbars: NonNullable<SheetExtension['toolbar']>[]
  menus: NonNullable<SheetExtension['contextMenu']>[]
  setups: NonNullable<SheetExtension['setup']>[]
  transactions: NonNullable<SheetExtension['transaction']>[]
  updates: NonNullable<SheetExtension['update']>[]
  pasteTransforms: NonNullable<SheetExtension['transformPaste']>[]
  overlays: Component[]
  layers: { below: Component[]; above: Component[] }
  history?: SheetExtension['history']
  comments?: SheetExtension['comments']
}

type ExtensionList = readonly (SheetExtension | readonly SheetExtension[])[]

function flatten(list: ExtensionList): SheetExtension[] {
  const out: SheetExtension[] = []
  for (const item of list) {
    if (Array.isArray(item)) out.push(...flatten(item))
    else out.push(item as SheetExtension)
  }
  return out
}

/** Sorts the extensions by priority and collects what they add. */
export function resolveSheetExtensions(list: ExtensionList = []): ResolvedSheetExtensions {
  const extensions = flatten(list)
    .map((extension, index) => ({ extension, index }))
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    .sort(
      (a, b) => (b.extension.priority ?? 100) - (a.extension.priority ?? 100) || a.index - b.index,
    )
    .map((entry) => entry.extension)

  const names = new Set<string>()
  for (const extension of extensions) {
    if (names.has(extension.name))
      throw new Error(`[@dou-ui/sheet] the extension "${extension.name}" is added twice`)
    names.add(extension.name)
  }

  const pick = <K extends keyof SheetExtension>(key: K) =>
    extensions.flatMap((e) => (e[key] ? [e[key]] : [])) as NonNullable<SheetExtension[K]>[]

  const keepers = extensions.filter((extension) => extension.comments)
  if (keepers.length > 1)
    throw new Error('[@dou-ui/sheet] only one extension may keep the comment threads')

  return {
    extensions,
    // the first (highest priority) extension to name a type wins
    cellTypes: extensions.flatMap((e) => e.cellTypes ?? []),
    // added in reverse, so the highest priority one is added last and wins
    // oxlint-disable-next-line unicorn/no-array-reverse -- reverses a fresh array
    functions: extensions.flatMap((e) => e.functions ?? []).reverse(),
    commands: extensions.flatMap((e) =>
      e.commands ? [{ extension: e.name, commands: e.commands }] : [],
    ),
    exporters: extensions.flatMap((e) =>
      (e.exporters ?? []).map((exporter) => ({ extension: e.name, exporter })),
    ),
    importers: extensions.flatMap((e) =>
      (e.importers ?? []).map((importer) => ({ extension: e.name, importer })),
    ),
    keymaps: pick('keymap'),
    toolbars: pick('toolbar'),
    menus: pick('contextMenu'),
    setups: pick('setup'),
    transactions: pick('transaction'),
    updates: pick('update'),
    pasteTransforms: pick('transformPaste'),
    overlays: extensions.flatMap((e) => e.overlays ?? []),
    layers: {
      below: extensions.flatMap((e) => e.layers?.below ?? []),
      above: extensions.flatMap((e) => e.layers?.above ?? []),
    },
    history: extensions.find((e) => e.history)?.history,
    comments: keepers[0]?.comments,
  }
}
