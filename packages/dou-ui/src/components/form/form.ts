import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { Size } from '../../utils/types'
import type { StandardSchemaV1 } from './standard-schema'

/**
 * - `vertical`: the label sits above its field.
 * - `horizontal`: labels form a column to the left and line up across items.
 * - `inline`: items flow in a row, e.g. a filter bar.
 */
export type FormLayout = 'vertical' | 'horizontal' | 'inline'
/** Which side of the label column the text hugs, in the horizontal layout. */
export type FormLabelAlign = 'start' | 'end'
/**
 * - `true`: mark required fields with an asterisk.
 * - `'optional'`: leave required fields alone and mark the optional ones.
 * - `false`: mark nothing.
 */
export type FormRequiredMark = boolean | 'optional'
/** What makes a field check its value. */
export type FormTrigger = 'change' | 'blur'
export type FormModel = Record<string, any>

/**
 * What a validator returns: `true` or nothing passes, `false` fails with
 * the rule's `message`, and a string fails with that string as the
 * message. Throwing an error fails with the error's message.
 */
export type FormValidatorResult = boolean | string | void

export interface FormRule {
  /** The value must not be empty: `undefined`, `null`, blank text, an empty list or `false`. */
  required?: boolean
  /** The kind of value expected. */
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'email' | 'url'
  /** The least length of text, number of items, or number. */
  min?: number
  /** The greatest length of text, number of items, or number. */
  max?: number
  /** A pattern text must match. */
  pattern?: RegExp
  /** Custom check. May be async. Runs even when the value is empty. */
  validator?: (
    value: unknown,
    model: FormModel,
  ) => FormValidatorResult | Promise<FormValidatorResult>
  /**
   * A schema the value must pass, e.g. one from a validation library that
   * implements Standard Schema. Fails with the schema's first message.
   * Runs even when the value is empty, so the schema decides about that.
   */
  schema?: FormSchema
  /** Replaces the default message. */
  message?: string
  /**
   * Limit the rule to these events. When omitted, text fields check on
   * blur and, once they show an error, on every change; choices check on
   * every change.
   */
  trigger?: FormTrigger | FormTrigger[]
}

/**
 * A Standard Schema. Some libraries build schemas as functions, so a
 * callable one is accepted too.
 */
export type FormSchema = StandardSchemaV1 | CallableSchema

export interface CallableSchema extends StandardSchemaV1 {
  (...args: any[]): unknown
}

/** A rule, or a schema on its own as shorthand for `{ schema }`. */
export type FormRuleItem = FormRule | FormSchema

/** Rules by field path, e.g. `name` or `address.city`. */
export type FormRules = Record<string, FormRuleItem | FormRuleItem[]>
/** The first failing message by field path. */
export type FormErrors = Record<string, string>

export interface FormValidateResult {
  valid: boolean
  errors: FormErrors
}

export interface FormProps {
  /** The object the fields write to. Pass a reactive object so `resetFields` can restore values. */
  model?: FormModel
  rules?: FormRules
  /**
   * A schema for the whole `model`. Each field shows the first issue whose
   * path is its `prop` (or lies inside it), next to its own rules.
   */
  schema?: FormSchema
  layout?: FormLayout
  labelAlign?: FormLabelAlign
  /** Width of the label column in the horizontal layout. Defaults to the widest label. */
  labelWidth?: string | number
  /** Size of every control inside, unless a control sets its own. */
  size?: Size
  /** Disable every control inside. */
  disabled?: boolean
  /**
   * Make every control inside read-only: values show as usual and can be
   * selected and copied, but not changed.
   */
  readonly?: boolean
  requiredMark?: FormRequiredMark
  /** On a failed submit, scroll to the first invalid field and focus it. */
  scrollToError?: boolean
}

export interface FormEmits {
  /** The form was submitted and every field passed. */
  submit: [model: FormModel]
  /** The form was submitted and some fields failed. */
  invalid: [errors: FormErrors]
  /** The form was reset and the fields hold their initial values again. */
  reset: []
}

export interface FormSlots {
  default?: () => unknown
}

export interface FormExpose {
  /** Check the given fields, or every field. Never rejects. */
  validate: (props?: string | string[]) => Promise<FormValidateResult>
  /** Restore the given fields, or every field, to their initial values and clear their errors. */
  resetFields: (props?: string | string[]) => void
  /** Clear the errors of the given fields, or every field. */
  clearValidate: (props?: string | string[]) => void
  /** Scroll a field into view and focus it. */
  scrollToField: (prop: string) => void
  /**
   * Show errors by field path, e.g. ones a server returned after submit.
   * Each stays until the field's value changes or it is checked again; an
   * empty message clears the field's error. Paths with no field in the
   * form are left out.
   */
  setErrors: (errors: FormErrors) => void
}

export interface FormItemProps {
  label?: string
  /** Path of the value in the form's `model`, e.g. `name` or `address.city`. Needed for validation. */
  prop?: string
  /** Added to the form's rules for this field. */
  rules?: FormRuleItem | FormRuleItem[]
  /** Shorthand for a `required` rule. */
  required?: boolean
  /** A hint shown below the field. Replaced by the error while there is one. */
  help?: string
  /** Show this error regardless of the rules, e.g. one returned by a server. */
  error?: string
  /** Overrides the form's `labelWidth` for this item. */
  labelWidth?: string | number
}

export interface FormItemSlots {
  default?: () => unknown
  /** Replaces the `label` text. */
  label?: () => unknown
  /** Replaces the `help` text. */
  help?: () => unknown
}

export interface FormItemExpose {
  /** The error currently shown, if any. */
  readonly error: string
  validate: () => Promise<string | null>
  reset: () => void
  clear: () => void
  /** Show an error until the value changes or it is checked again; `''` clears it. */
  setError: (message: string) => void
}

/** What a form item registers with its form. */
export interface FormItemHandle {
  prop: () => string | undefined
  el: () => HTMLElement | null
  validate: () => Promise<string | null>
  reset: () => void
  clear: () => void
  setError: (message: string) => void
  focus: () => void
}

export interface FormContext {
  model: () => FormModel | undefined
  rules: () => FormRules | undefined
  schema: () => FormSchema | undefined
  layout: ComputedRef<FormLayout>
  size: ComputedRef<Size | undefined>
  disabled: ComputedRef<boolean>
  readonly: ComputedRef<boolean>
  requiredMark: ComputedRef<FormRequiredMark>
  register: (item: FormItemHandle) => void
  unregister: (item: FormItemHandle) => void
}

/** What a form item hands to the control inside it. */
export interface FormItemContext {
  /** Give this to the control's focusable element, so the label points at it. */
  inputId: string
  labelId: string
  /** Ids of the help or error text, for `aria-describedby`. */
  describedBy: ComputedRef<string | undefined>
  invalid: ComputedRef<boolean>
  required: ComputedRef<boolean>
  /**
   * Report an event so the item can check its value. `lazy` is for typing
   * in text: it only rechecks a field that already shows an error.
   */
  trigger: (event: FormTrigger, options?: { lazy?: boolean }) => void
  /**
   * Call from a control that groups several inputs. The item then labels
   * the group with `aria-labelledby` instead of a `<label for>`.
   */
  markGroup: () => void
  isGroup: Readonly<Ref<boolean>>
}

export const formKey: InjectionKey<FormContext> = Symbol('DouForm')
export const formItemKey: InjectionKey<FormItemContext> = Symbol('DouFormItem')
