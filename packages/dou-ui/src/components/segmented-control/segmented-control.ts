import type { Size } from '../../utils/types'

export type SegmentedControlSize = Size
export type SegmentedControlValue = string | number | boolean

export interface SegmentedControlOption {
  value: SegmentedControlValue
  /** Defaults to the value. */
  label?: string
  disabled?: boolean
}

export interface SegmentedControlProps {
  /** The selected value, bound with `v-model`. */
  modelValue?: SegmentedControlValue
  /** The choices. A plain string or number is both value and label. */
  options: (SegmentedControlOption | string | number)[]
  size?: SegmentedControlSize
  disabled?: boolean
  /** Show the value without letting it change: the field can still be focused and its text selected. */
  readonly?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** Stretch to the width of the parent and share it evenly between the options. */
  block?: boolean
  /** The native `name` shared by the options. Generated when omitted. */
  name?: string
}

export interface SegmentedControlEmits {
  'update:modelValue': [value: SegmentedControlValue]
  /** The user picked another option. */
  change: [value: SegmentedControlValue]
}

export interface SegmentedControlSlots {
  /** Replaces the label of each option, e.g. to add an icon. */
  option?: (props: { option: SegmentedControlOption; checked: boolean }) => unknown
}
