export type SplitterDirection = 'horizontal' | 'vertical'

/** A percentage of the splitter as a number, or a length in px as `'240px'`. */
export type SplitterLimit = number | `${number}px`

export interface SplitterProps {
  /** The size of the first pane in percent, bound with `v-model`. */
  modelValue?: number
  /** `horizontal` puts the panes side by side; `vertical` stacks them. */
  direction?: SplitterDirection
  /** The smallest the first pane may get. */
  min?: SplitterLimit
  /** The largest the first pane may get; the second pane keeps the rest. */
  max?: SplitterLimit
  /** Let the first pane fold away with `Enter` or a double click on the divider. */
  collapsible?: boolean
  /** Whether the first pane is folded away, bound with `v-model:collapsed`. */
  collapsed?: boolean
  /** Percent moved by each arrow key; `Shift` moves ten times as far. */
  step?: number
  disabled?: boolean
  /** Names the divider for screen readers. */
  ariaLabel?: string
}

export interface SplitterEmits {
  'update:modelValue': [value: number]
  'update:collapsed': [value: boolean]
  /** A drag or a key press finished resizing. */
  change: [value: number]
}

export interface SplitterSlots {
  /** The first pane: left, or top when `vertical`. */
  start?: () => unknown
  /** The second pane: right, or bottom when `vertical`. */
  end?: () => unknown
}
