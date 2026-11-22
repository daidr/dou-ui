export type SplitterDirection = 'horizontal' | 'vertical'

/**
 * Unit of `modelValue`, `step`, and numeric `min` / `max` / `minEnd`:
 * `'percent'` (0–100) or `'px'` (pixels).
 */
export type SplitterUnit = 'percent' | 'px'

/** Which pane to show alone when `singlePane` is active. */
export type SplitterPane = 'start' | 'end'

/** A number in the active `unit` (`percent` or `px`), or a length in px as `'240px'`. */
export type SplitterLimit = number | `${number}px`

export interface SplitterProps {
  /**
   * The size of the first pane, bound with `v-model`.
   * Interpreted according to `unit` (defaults to `50` in `'percent'` mode, `240` in `'px'` mode).
   */
  modelValue?: number
  /** `horizontal` puts the panes side by side; `vertical` stacks them. */
  direction?: SplitterDirection
  /**
   * Unit for `modelValue`, `step`, and numeric limits (`min`, `max`, `minEnd`).
   * In `'px'` mode, the first pane keeps its pixel size when the container resizes
   * and the divider width is accounted for automatically.
   */
  unit?: SplitterUnit
  /** The smallest the first pane may get. */
  min?: SplitterLimit
  /**
   * The largest the first pane may get; the second pane keeps the rest.
   * Defaults to `100` in `'percent'` mode and unbounded (up to container minus `minEnd`) in `'px'` mode.
   */
  max?: SplitterLimit
  /**
   * The smallest the second pane may get. When the splitter is too small
   * for both `min` and `minEnd`, the two panes share it in proportion.
   */
  minEnd?: SplitterLimit
  /** Let the first pane fold away with `Enter` or a double click on the divider. */
  collapsible?: boolean
  /** Whether the first pane is folded away, bound with `v-model:collapsed`. */
  collapsed?: boolean
  /**
   * Show only one pane at full size while keeping both panes mounted in the DOM,
   * hiding the divider and the inactive pane. Set to `null` or `undefined` to show both panes.
   */
  singlePane?: SplitterPane | null
  /**
   * Amount moved by each arrow key in the active `unit`; `Shift` moves ten times as far.
   * Defaults to `1` in `'percent'` mode and `10` in `'px'` mode.
   */
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
