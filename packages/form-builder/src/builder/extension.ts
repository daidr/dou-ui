import type { Component } from 'vue'
import type { FormNode } from '../core/types'
import type { FormFieldType } from '../fields/define'
import type { FormBuilderContext } from './context'
import type { FormBuilderTransaction } from './core/transaction'

/** What an extension's hooks receive; the same as `useFormBuilder()`. */
export type FormBuilderExtensionContext = FormBuilderContext

/**
 * A key handler: return `false` to let the key through to the next handler
 * and the builder's own keys; anything else means it was handled.
 */
export type FormBuilderKeyHandler = (event: KeyboardEvent) => boolean | void

/** A button of the toolbar over the canvas. */
export interface FormBuilderToolbarItem {
  key: string
  /** Read out, and shown as the tooltip; shown beside the icon when there is no icon. */
  label: string
  icon?: Component
  run: () => void
  disabled?: boolean
  /** For a button that turns something on and off: whether it is on. */
  pressed?: boolean
  /**
   * The key that does the same, as a hotkey like `alt+r`: shown in the
   * tooltip and given to screen readers as `aria-keyshortcuts`. It is only
   * a hint; bind the key with `keymap`.
   */
  shortcut?: string
}

/** An item of a node's menu: its "more" button and the right-click menu. */
export interface FormBuilderMenuItem {
  key: string
  label: string
  icon?: Component
  run: () => void
  disabled?: boolean
  tone?: 'neutral' | 'danger'
  /** The key that does the same, as a hotkey like `alt+r`, shown at the end of the item. */
  shortcut?: string
}

/**
 * A mark on a node of the canvas and the outline, e.g. who else has it
 * selected: an outline in its color and a tag with its label.
 */
export interface FormBuilderNodeMark {
  key: string
  label: string
  /** Any CSS color; the text color when left out. */
  color?: string
}

/** An undo history that replaces the builder's own, e.g. one that only undoes this user's changes. */
export interface FormBuilderHistoryHandler {
  /** `false` when there was nothing to undo. */
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
}

/** A part of the inspector, under the built-in settings. */
export interface FormBuilderInspectorSection {
  key: string
  /** The heading over it. */
  title: string
  /** Rendered with `props`; it can call `useFormBuilder()`. */
  component: Component
  props?: Record<string, unknown>
}

/**
 * A piece of the builder: field types, keys, toolbar buttons, menu items,
 * parts of the inspector, and a say in every change.
 */
export interface FormBuilderExtension {
  name: string
  /** Higher runs first: its keys and hooks come before others. Defaults to 100. */
  priority?: number
  /**
   * Field types for the palette, besides the `fields` prop. Give the
   * renderer the same types (`resolveFormBuilderFields` collects them).
   */
  fields?: FormFieldType<any>[]
  /**
   * Replaces the text box for expressions (formulas, checks, conditions
   * written as text), e.g. with the code input of
   * `@dou-ui/form-builder/code`. It gets the built-in box's props:
   * `modelValue`, `names`, `itemNames`, `readsValue`, `placeholder`,
   * `disabled`, and emits `update:modelValue`. The first one by priority
   * is used.
   */
  expressionInput?: Component
  /**
   * Keys, written as in `useHotkey` (e.g. `mod+e`, `shift+t`), while the
   * canvas or the outline has focus. They come before the builder's own.
   */
  keymap?: (context: FormBuilderExtensionContext) => Record<string, FormBuilderKeyHandler>
  /** Buttons after undo and redo, before the `toolbar` slot. */
  toolbar?: (context: FormBuilderExtensionContext) => FormBuilderToolbarItem[]
  /** Items for the menu of the selected nodes, after the built-in ones. */
  menu?: (context: FormBuilderExtensionContext, nodes: FormNode[]) => FormBuilderMenuItem[]
  /**
   * Parts of the inspector for a node, or the form when `node` is
   * `undefined`, after the built-in settings.
   */
  inspector?: (
    context: FormBuilderExtensionContext,
    node: FormNode | undefined,
  ) => FormBuilderInspectorSection[]
  /**
   * Marks for a node, read while the node renders: reactive state read
   * here updates them.
   */
  marks?: (context: FormBuilderExtensionContext, node: FormNode) => FormBuilderNodeMark[]
  /** Replaces the builder's undo history; the first extension that has one wins. */
  history?: (context: FormBuilderExtensionContext) => FormBuilderHistoryHandler
  /** Runs once the builder is mounted. Return a function to run when it unmounts. */
  setup?: (context: FormBuilderExtensionContext) => void | (() => void)
  /**
   * Sees every change before it reaches the document, in priority order,
   * and may add steps to it, e.g. to name new fields by a rule of the app.
   * Undo and redo do not come through here: they put back what was there.
   */
  transaction?: (tr: FormBuilderTransaction, context: FormBuilderExtensionContext) => void
}

/** Declares an extension; only gives it a type. */
export function defineFormBuilderExtension(extension: FormBuilderExtension): FormBuilderExtension {
  return extension
}

/** Everything the extensions contribute, gathered once per list. */
export interface ResolvedFormBuilderExtensions {
  extensions: FormBuilderExtension[]
  fields: FormFieldType<any>[]
  keymaps: NonNullable<FormBuilderExtension['keymap']>[]
  toolbars: NonNullable<FormBuilderExtension['toolbar']>[]
  menus: NonNullable<FormBuilderExtension['menu']>[]
  inspectors: NonNullable<FormBuilderExtension['inspector']>[]
  setups: NonNullable<FormBuilderExtension['setup']>[]
  marks: NonNullable<FormBuilderExtension['marks']>[]
  history: FormBuilderExtension['history']
  expressionInput: FormBuilderExtension['expressionInput']
  transactions: NonNullable<FormBuilderExtension['transaction']>[]
}

type ExtensionList = readonly (FormBuilderExtension | readonly FormBuilderExtension[])[]

function flatten(list: ExtensionList): FormBuilderExtension[] {
  const out: FormBuilderExtension[] = []
  for (const item of list) {
    if (Array.isArray(item)) out.push(...flatten(item))
    else out.push(item as FormBuilderExtension)
  }
  return out
}

/** Sorts the extensions by priority and collects what they add. */
export function resolveFormBuilderExtensions(
  list: ExtensionList = [],
): ResolvedFormBuilderExtensions {
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
      throw new Error(`[@dou-ui/form-builder] the extension "${extension.name}" is added twice`)
    names.add(extension.name)
  }

  const pick = <K extends keyof FormBuilderExtension>(key: K) =>
    extensions.flatMap((e) => (e[key] ? [e[key]] : [])) as NonNullable<FormBuilderExtension[K]>[]

  return {
    extensions,
    fields: extensions.flatMap((e) => e.fields ?? []),
    keymaps: pick('keymap'),
    toolbars: pick('toolbar'),
    menus: pick('menu'),
    inspectors: pick('inspector'),
    setups: pick('setup'),
    marks: pick('marks'),
    history: extensions.find((e) => e.history)?.history,
    expressionInput: extensions.find((e) => e.expressionInput)?.expressionInput,
    transactions: pick('transaction'),
  }
}

/**
 * The field types of a builder with extensions, for the renderer that
 * shows its forms: the given ones, then the extensions'.
 */
export function resolveFormBuilderFields(
  fields: readonly FormFieldType<any>[] = [],
  extensions: ExtensionList = [],
): FormFieldType<any>[] {
  return [...fields, ...resolveFormBuilderExtensions(extensions).fields]
}
