import type { Size } from '../../utils/types'

export type SliderSize = Size
/** One number, or the two ends of a range. */
export type SliderValue = number | [number, number]

/** Labels along the track, by the value they mark. */
export type SliderMarks = Record<number, string>

export interface SliderProps {
  /** The value, bound with `v-model`. A pair of numbers when `range` is set. */
  modelValue?: SliderValue
  /** Pick a range with two thumbs instead of a single value. */
  range?: boolean
  min?: number
  max?: number
  /** The values the thumbs snap to are `min` plus whole multiples of `step`. */
  step?: number
  size?: SliderSize
  disabled?: boolean
  /** Show the value without letting it change: the field can still be focused and its text selected. */
  readonly?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the fill in the danger tone. */
  invalid?: boolean
  /** Labels along the track. */
  marks?: SliderMarks
  /** Turn a value into the text read by screen readers, e.g. `(v) => \`${v}%\``. */
  format?: (value: number) => string
  /** Run the track bottom to top. */
  vertical?: boolean
  /** The length of a vertical slider. A number is in px. */
  height?: number | string
  /**
   * Show the value in a bubble over the thumb: `true` while it is dragged,
   * hovered or focused with the keyboard, `'always'` all the time. The text
   * comes from `format` when given.
   */
  tooltip?: boolean | 'always'
  /** Put a number input beside a single slider, kept in sync with it. */
  showInput?: boolean
}

export interface SliderEmits {
  /** Fires continuously while dragging. */
  'update:modelValue': [value: SliderValue]
  /** The value was committed: the drag ended, or a key or click moved a thumb. */
  change: [value: SliderValue]
}

export interface SliderExpose {
  /** Focus the first thumb. */
  focus: () => void
  blur: () => void
}
