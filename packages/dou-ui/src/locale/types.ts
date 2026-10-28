/**
 * Every string DouUI renders on its own: labels read by screen readers
 * and the default messages of form rules.
 *
 * Messages may contain `{name}` placeholders, filled in when the string
 * is used.
 */
export interface Locale {
  /** A BCP 47 language tag, e.g. `zh-CN`. */
  name: string
  input: {
    /** Label of the clear button. */
    clear: string
  }
  tag: {
    /** Label of the remove button. */
    remove: string
  }
  inputNumber: {
    /** Label of the button that steps the value up. */
    increase: string
    /** Label of the button that steps the value down. */
    decrease: string
  }
  slider: {
    /** Label of the lower thumb of a range. */
    start: string
    /** Label of the upper thumb of a range. */
    end: string
  }
  alert: {
    /** Label of the close button. */
    close: string
  }
  dialog: {
    /** Label of the close button. */
    close: string
  }
  drawer: {
    /** Label of the close button. */
    close: string
  }
  select: {
    /** Shown in an empty select without a `placeholder`. */
    placeholder: string
    /** Shown when no option matches the search. */
    empty: string
    /** Label of the clear button. */
    clear: string
  }
  spinner: {
    /** Read by screen readers while a spinner shows. */
    loading: string
  }
  toast: {
    /** Names the region that holds the toasts. */
    region: string
    /** Label of the close button. */
    close: string
  }
  empty: {
    /** Headline of an empty state without a title or description of its own. */
    title: string
  }
  breadcrumb: {
    /** Names the navigation landmark. */
    label: string
    /** Label of the ellipsis that expands a collapsed path. */
    expand: string
  }
  pagination: {
    /** Names the navigation landmark. */
    label: string
    /** Label of the previous page button. */
    prev: string
    /** Label of the next page button. */
    next: string
    /** Label of a page button, with `{page}`. */
    page: string
    /** The number of items, with `{total}`. */
    total: string
    /** An option of the page size select, with `{size}`. */
    pageSize: string
    /** Label of the page size select. */
    pageSizeLabel: string
  }
  table: {
    /** Label of the checkbox that selects every row. */
    selectAll: string
    /** Label of the checkbox that selects one row. */
    selectRow: string
  }
  upload: {
    /** The button that opens the file picker. */
    choose: string
    /** The dropzone's prompt, followed by `browse`. */
    drop: string
    /** The part of the dropzone's prompt that reads as a link. */
    browse: string
    /** Names the list of files. */
    list: string
    /** Label of the remove button, followed by the file name. */
    remove: string
    /** Label of the retry button, followed by the file name. */
    retry: string
    /** Shown while a file is sent, followed by the percentage. */
    uploading: string
    /** Shown when a file failed to send. */
    error: string
  }
  form: {
    /** Shown after the label of an optional field when `requiredMark` is `'optional'`. */
    optional: string
    /** A required field is empty. */
    required: string
    /** A text is shorter than `{min}` characters. */
    minLength: string
    /** A text is longer than `{max}` characters. */
    maxLength: string
    /** Fewer than `{min}` items are chosen. */
    minItems: string
    /** More than `{max}` items are chosen. */
    maxItems: string
    /** A number is below `{min}`. */
    min: string
    /** A number is above `{max}`. */
    max: string
    /** The value does not match `pattern`. */
    pattern: string
    email: string
    url: string
    /** A custom validator failed without a message of its own. */
    invalid: string
  }
}
