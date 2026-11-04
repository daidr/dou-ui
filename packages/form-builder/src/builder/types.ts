import type { FormFunction } from '../core/expression'
import type { FormDocument, FormValidator } from '../core/types'
import type { FormFieldType } from '../fields/define'
import type { FormOptionsLoader } from '../renderer/context'
import type { FormBuilderMessagesOverride } from './locale'
import type { FormBuilderContext, FormBuilderMode } from './context'
import type { FormBuilderExtension } from './extension'
import type { FormBuilderTransaction } from './core/transaction'

export interface FormBuilderProps {
  /** The form being built, bound with `v-model`. Each change hands over a new document. */
  modelValue: FormDocument
  /** The ids of the selected nodes, bound with `v-model:selection`. */
  selection?: string[]
  /** Field types besides the built-in ones, the same list the renderer gets. */
  fields?: FormFieldType<any>[]
  /** Show the canvas (`design`, the default) or the form to fill in (`preview`), bound with `v-model:mode`. */
  mode?: FormBuilderMode
  /**
   * Functions the expressions can call, the same as the renderer's: the
   * preview runs them, and the inspector completes and checks their names.
   */
  functions?: Record<string, FormFunction>
  /** Where options come from, the same as the renderer's, for the preview. */
  sources?: Record<string, FormOptionsLoader>
  /**
   * Checks that need code, the same as the renderer's: the preview runs
   * them, and the rules editor offers their names.
   */
  validators?: Record<string, FormValidator>
  /**
   * Show the form without letting it change: nodes can be selected, their
   * settings read and the form previewed, but nothing can be added, moved,
   * removed or edited.
   */
  readonly?: boolean
  /**
   * The hairline frame and rounded corners. Off, the builder takes no
   * border at all, for a page region or dialog that already has an edge.
   * On by default.
   */
  bordered?: boolean
  /** Pieces of the builder: field types, keys, buttons, menu items, inspector parts. */
  extensions?: (FormBuilderExtension | readonly FormBuilderExtension[])[]
  /** Replaces texts of the builder. */
  messages?: FormBuilderMessagesOverride
}

export interface FormBuilderEmits {
  'update:modelValue': [document: FormDocument]
  'update:selection': [ids: string[]]
  'update:mode': [mode: FormBuilderMode]
  /** A change was made: the transaction, with its steps and `meta`. Also for undo and redo. */
  change: [tr: FormBuilderTransaction]
}

export interface FormBuilderSlots {
  /**
   * Replaces the layout: place `DouFormBuilderPalette`, `DouFormBuilderCanvas`,
   * `DouFormBuilderInspector`, `DouFormBuilderOutline` and
   * `DouFormBuilderPreview` as you like.
   */
  default?: () => unknown
  /** Buttons after undo and redo, over the canvas. */
  toolbar?: () => unknown
}

/** What a builder's ref gives, the same as `useFormBuilder()` inside it. */
export type FormBuilderExpose = FormBuilderContext
