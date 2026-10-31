import type { Component } from 'vue'
import type { SheetContext } from '../context'
import type { SheetMenuContext, SheetMenuItem } from '../types'
import type { SheetFunction } from '../formula/functions'
import type { SheetCellType } from './cell-type'
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
   * Keys, written as in `useHotkey` (e.g. `mod+b`, `alt+arrowdown`), while the
   * grid has focus and no cell is being edited. They come before the grid's own.
   */
  keymap?: (context: SheetExtensionContext) => Record<string, SheetKeyHandler>
  /** Items for the right-click menu, put before the built-in ones. */
  contextMenu?: (context: SheetExtensionContext, menu: SheetMenuContext) => SheetMenuItem[]
  /**
   * Components drawn over the grid, not scrolled with it, e.g. a panel or
   * marks placed with `cellRect`. They can call `useSheet()`.
   */
  overlays?: Component[]
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
  keymaps: NonNullable<SheetExtension['keymap']>[]
  menus: NonNullable<SheetExtension['contextMenu']>[]
  setups: NonNullable<SheetExtension['setup']>[]
  transactions: NonNullable<SheetExtension['transaction']>[]
  overlays: Component[]
  history?: SheetExtension['history']
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

  return {
    extensions,
    // the first (highest priority) extension to name a type wins
    cellTypes: extensions.flatMap((e) => e.cellTypes ?? []),
    // added in reverse, so the highest priority one is added last and wins
    // oxlint-disable-next-line unicorn/no-array-reverse -- reverses a fresh array
    functions: extensions.flatMap((e) => e.functions ?? []).reverse(),
    keymaps: pick('keymap'),
    menus: pick('contextMenu'),
    setups: pick('setup'),
    transactions: pick('transaction'),
    overlays: extensions.flatMap((e) => e.overlays ?? []),
    history: extensions.find((e) => e.history)?.history,
  }
}
