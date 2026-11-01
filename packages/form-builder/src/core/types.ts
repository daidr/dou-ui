import type {
  FormLabelAlign,
  FormLayout,
  FormModel,
  FormRequiredMark,
  FormValidatorResult,
  Size,
} from 'dou-ui'

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

export type FormNode =
  FormFieldNode | FormSectionNode | FormTabsNode | FormStepsNode | FormPageNode | FormListNode

/** The nodes that hold other nodes. */
export type FormContainerNode =
  FormSectionNode | FormTabsNode | FormStepsNode | FormPageNode | FormListNode

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
   * expression for what to ask it, e.g. `{ name: 'cities', arg: 'values.province' }`.
   * Asked again when the result of `arg` changes; a value the new options
   * no longer offer is cleared, unless `keep` is set.
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
  /**
   * An expression; its result is handed to the source. To hand over
   * several values, make it a list: `[values.province, values.kind]`.
   */
  arg?: string
  /** Keep the field's value when the options change and no longer offer it. */
  keep?: boolean
}

/** Pages shown one at a time, picked from a row of tabs. */
export interface FormTabsNode extends FormNodeBase {
  type: 'tabs'
  /** The pages, one per tab. */
  children: FormPageNode[]
}

/**
 * Pages filled in one after another. Each page is checked before the
 * next one opens; going back is always allowed.
 */
export interface FormStepsNode extends FormNodeBase {
  type: 'steps'
  /** The pages, one per step. */
  children: FormPageNode[]
}

/** One page of `tabs` or `steps`. A hidden page (`visibleWhen`) is left out. */
export interface FormPageNode extends FormNodeBase {
  type: 'page'
  /** The text of the tab or step. */
  title: string
  description?: string
  /** Columns of the page's own grid. Defaults to the document's. */
  columns?: number
  children: FormNode[]
}

/**
 * A list of items that people add, remove and reorder, each made of the
 * same fields, e.g. the people on a booking. The value at `name` is a
 * list of objects; the fields inside name their own key in an item
 * (`name: 'phone'` writes `item.phone`) and read the item in
 * expressions as `item`.
 */
export interface FormListNode extends FormNodeBase {
  type: 'list'
  /** The path of the list, e.g. `guests`. */
  name: string
  label?: string
  help?: string
  /** The items the list starts with. Defaults to `min` empty items. */
  default?: Record<string, unknown>[]
  /** Fewest items; below it items cannot be removed. */
  min?: number
  /** Most items; at it no more can be added. */
  max?: number
  /** Let people drag items into another order. Defaults to `true`. */
  sortable?: boolean
  /** Text of the add button. Defaults to the locale's. */
  addText?: string
  /** Checks of the list itself, e.g. `required` for at least one item. */
  required?: boolean
  rules?: FormRuleSpec[]
  /** Columns of each item's grid. Defaults to the document's. */
  columns?: number
  /** The fields of one item. */
  children: FormNode[]
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
  /**
   * The name of a check given to the renderer's `validators`, for what an
   * expression cannot do, e.g. asking the server whether a name is taken.
   * Skips an empty value too. Ignored when the rule has a `check`.
   */
  validator?: string
  /** Replaces the default message. */
  message?: string
  trigger?: 'change' | 'blur'
}

/** What a validator gets besides the value. */
export interface FormValidatorContext {
  /** The whole form's values. */
  values: FormModel
  /** Inside a list, the item the field belongs to; else `null`. */
  item: unknown
  /** The path of the field, e.g. `username` or `guests.2.phone`. */
  path: string
}

/**
 * A check of a field's value. Return `true` or nothing to pass, `false` to
 * fail with the rule's `message`, or a string to fail with that string.
 * May be async. Like the other checks of a rule, it is skipped while the
 * value is empty; that is `required`'s job.
 */
export type FormValidator = (
  value: unknown,
  context: FormValidatorContext,
) => FormValidatorResult | Promise<FormValidatorResult>
