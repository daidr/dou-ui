import type { InjectionKey } from 'vue'
import type { FormModel, FormRules, FormValidateResult } from 'dou-ui'
import type { FormFieldType } from '../fields/define'
import type { FormDocument } from '../core/types'
import type { FormFunction } from '../core/expression'

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
  /**
   * Functions the document's expressions can call besides the built-in
   * ones, e.g. `{ tax: (price) => price * 0.06 }`. They get plain values
   * and should not change them; one of the same name replaces a built-in function.
   */
  functions?: Record<string, FormFunction>
  /**
   * Where options come from, by the name a node's `source` gives. A source
   * gets the result of the node's `arg` expression and returns the
   * options, or a promise of them. Results are kept for each name and
   * `arg`, so fields asking the same thing share one call. `reloadSource`
   * forgets them, e.g. after the options changed on the server.
   */
  sources?: Record<string, FormOptionsLoader>
}

/** Loads the options of a field, given the result of its `source.arg`. */
export type FormOptionsLoader = (arg: any) => unknown[] | Promise<unknown[]>

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
  /** Forget the options loaded from a source, or from every source, and load them again. */
  reloadSource: (name?: string) => void
}

/** What every node of a renderer reads. */
export interface RendererContext {
  model: () => FormModel
  fields: () => Map<string, FormFieldType>
  /** Pixel width of the label column in the horizontal layout, else `undefined`. */
  labelWidth: () => number | undefined
  /** Tell the renderer a field wrote a value. */
  changed: (name: string, value: unknown) => void
  /** The functions expressions can call besides the built-in ones. */
  functions: () => Record<string, FormFunction> | undefined
  /** The options from a source, shared by every field asking the same thing. */
  load: (name: string, arg: unknown) => Promise<unknown[]>
  /** Bumped by `reloadSource`, so fields reading it load again. */
  sourceVersion: (name: string) => number
}

export const rendererKey: InjectionKey<RendererContext> = Symbol('DouFormRenderer')
