import type { InjectionKey } from 'vue'
import type { FormModel, FormRules, FormValidateResult } from 'dou-ui'
import type { FormFieldType } from '../fields/define'
import type { FormDocument } from '../core/types'

export interface FormRendererProps {
  /** The form to render: its fields, groups and layout, as plain data. */
  form: FormDocument
  /**
   * The object the fields write to, changed in place. Pass a reactive
   * object to read the values as they change; fields missing from it are
   * filled with their defaults. Defaults to an object of the renderer's own.
   */
  model?: FormModel
  /** Field types besides the built-in ones; one of the same name replaces the built-in type. */
  fields?: FormFieldType<any>[]
  /** More rules by field name, e.g. checks that need code. Added to the document's own. */
  rules?: FormRules
  /** Disable every field. */
  disabled?: boolean
}

export interface FormRendererEmits {
  /** A field changed its value: its `name`, and the value it now holds. */
  change: [name: string, value: unknown]
  /** The form was submitted and every field passed. */
  submit: [model: FormModel]
  /** The form was submitted and some fields failed. */
  invalid: [errors: Record<string, string>]
  /** The form was reset to its starting values. */
  reset: []
}

export interface FormRendererSlots {
  /** After the fields, e.g. the submit and reset buttons. */
  default?: () => unknown
}

export interface FormRendererExpose {
  /** The object the fields write to. */
  readonly model: FormModel
  /** Check the given fields, or every field. Never rejects. */
  validate: (names?: string | string[]) => Promise<FormValidateResult>
  /** Restore the given fields, or every field, to their starting values and clear their errors. */
  resetFields: (names?: string | string[]) => void
  /** Clear the errors of the given fields, or every field. */
  clearValidate: (names?: string | string[]) => void
  /** Scroll a field into view and focus it. */
  scrollToField: (name: string) => void
}

/** What every node of a renderer reads. */
export interface RendererContext {
  model: () => FormModel
  fields: () => Map<string, FormFieldType>
  /** Pixel width of the label column in the horizontal layout, else `undefined`. */
  labelWidth: () => number | undefined
  /** Tell the renderer a field wrote a value. */
  changed: (name: string, value: unknown) => void
}

export const rendererKey: InjectionKey<RendererContext> = Symbol('DouFormRenderer')
