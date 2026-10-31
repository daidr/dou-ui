import type { FormDocument } from '../core/types'
import type { FormFieldType } from '../fields/define'
import type { FormBuilderMessagesOverride } from './locale'
import type { FormBuilderContext } from './context'
import type { FormBuilderTransaction } from './core/transaction'

export interface FormBuilderProps {
  /** The form being built, bound with `v-model`. Each change hands over a new document. */
  modelValue: FormDocument
  /** The ids of the selected nodes, bound with `v-model:selection`. */
  selection?: string[]
  /** Field types besides the built-in ones, the same list the renderer gets. */
  fields?: FormFieldType<any>[]
  /** Replaces texts of the builder. */
  messages?: FormBuilderMessagesOverride
}

export interface FormBuilderEmits {
  'update:modelValue': [document: FormDocument]
  'update:selection': [ids: string[]]
  /** A change was made: the transaction, with its steps and `meta`. Also for undo and redo. */
  change: [tr: FormBuilderTransaction]
}

export interface FormBuilderSlots {
  /**
   * Replaces the layout: place `DouFormBuilderPalette`, `DouFormBuilderCanvas`,
   * `DouFormBuilderInspector` and `DouFormBuilderOutline` as you like.
   */
  default?: () => unknown
  /** Buttons after undo and redo, over the canvas. */
  toolbar?: () => unknown
}

/** What a builder's ref gives, the same as `useFormBuilder()` inside it. */
export type FormBuilderExpose = FormBuilderContext
