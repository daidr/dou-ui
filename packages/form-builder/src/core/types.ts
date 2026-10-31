import type { FormLabelAlign, FormLayout, FormRequiredMark, Size } from 'dou-ui'

/** The form widths a responsive value switches at: 480, 640, 800 and 960px. */
export type FormBreakpoint = 'sm' | 'md' | 'lg' | 'xl'

/**
 * A value that may change with the width of the form (not of the
 * viewport, so a form in a narrow dialog stacks like it would on a
 * phone). Each breakpoint applies from its width up, until a larger one
 * takes over; `base` applies below every breakpoint.
 */
export type FormResponsive<T> = T | ({ base?: T } & Partial<Record<FormBreakpoint, T>>)

/**
 * A whole form, as plain data that survives `JSON.stringify`, so it can
 * be stored, sent and edited by the builder.
 */
export interface FormDocument {
  /** The shape of this data, for future migrations. Always `1` for now. */
  version: 1
  /** Passed to the form: labels above (`vertical`), beside (`horizontal`) or a row of fields (`inline`). */
  layout?: FormLayout
  labelAlign?: FormLabelAlign
  /** Width of the label column in the horizontal layout, in pixels. Defaults to 96. */
  labelWidth?: number
  size?: Size
  requiredMark?: FormRequiredMark
  /** How many columns the layout grid has. Defaults to 12. */
  columns?: number
  /** The fields and groups, in order. */
  nodes: FormNode[]
}

export type FormNode = FormFieldNode | FormSectionNode

interface FormNodeBase {
  /** Unique within the document, and kept when the node moves or changes. */
  id: string
  /** How many grid columns the node covers. Defaults to the whole row. */
  span?: FormResponsive<number>
  /**
   * An expression; the node shows only while it is true, e.g.
   * `values.type == 'laptop'`. A hidden field is not checked on submit.
   */
  visibleWhen?: string
  /** An expression; the node, and everything in a group, is disabled while it is true. */
  disabledWhen?: string
}

export interface FormFieldNode extends FormNodeBase {
  /** The field type, e.g. `input` or `select`, or one registered with `defineFormField`. */
  type: string
  /**
   * The path the value is written to, e.g. `name` or `contact.phone`.
   * Needed by every field that holds a value; display-only types such as
   * `text` or `divider` go without.
   */
  name?: string
  label?: string
  /** A hint shown below the field. */
  help?: string
  /** The value the field starts with. Defaults to the type's empty value. */
  default?: unknown
  /** Shorthand for a `{ required: true }` rule. */
  required?: boolean
  /** An expression; the field is required while it is true. Takes over from `required`. */
  requiredWhen?: string
  /**
   * An expression whose result the field holds, e.g.
   * `values.price * values.count`. It is worked out again whenever a value
   * it reads changes, and the field cannot be edited.
   */
  formula?: string
  /**
   * Where the options come from, for a type with options such as `select`:
   * the name of a source given to the renderer's `sources`, and an
   * expression for what to ask it, e.g. `{ name: 'cities', args: 'values.province' }`.
   * Asked again when the result of `args` changes.
   */
  source?: FormOptionSource
  /** Checks the value must pass, besides `required`. */
  rules?: FormRuleSpec[]
  /** Settings of the field type: a placeholder, the options of a select, a range… */
  props?: Record<string, unknown>
}

/** A titled group of nodes with its own grid. */
export interface FormSectionNode extends FormNodeBase {
  type: 'section'
  title?: string
  description?: string
  /** Draw a border around the group. */
  bordered?: boolean
  /** Columns of the group's own grid. Defaults to the document's. */
  columns?: number
  children: FormNode[]
}

export interface FormOptionSource {
  /** The key of the source in the renderer's `sources`. */
  name: string
  /** An expression; its result is handed to the source. */
  args?: string
}

/**
 * A check as plain data. Turned into a `FormRule` of the form, so it
 * behaves the same as rules written by hand.
 */
export interface FormRuleSpec {
  /** The value must not be empty. */
  required?: boolean
  type?: 'string' | 'number' | 'integer' | 'email' | 'url'
  /** The least length of text, number of items, or number. */
  min?: number
  /** The greatest length of text, number of items, or number. */
  max?: number
  /** A regular expression text must match, as source text without slashes, e.g. `^\\d{6}$`. */
  pattern?: string
  /** Flags for `pattern`, e.g. `i`. */
  flags?: string
  /**
   * An expression the value must make true, e.g. `value >= values.start`.
   * `value` is the field's value and `values` the whole form. Like `min`
   * and `pattern` it skips an empty value; that is `required`'s job.
   */
  check?: string
  /** Replaces the default message. */
  message?: string
  trigger?: 'change' | 'blur'
}
