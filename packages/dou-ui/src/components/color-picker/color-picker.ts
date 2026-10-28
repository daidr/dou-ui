import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'

export interface ColorPickerProps {
  /** A hex color, `#rrggbb`, or `#rrggbbaa` with `showAlpha`. Bound with `v-model`. */
  modelValue?: string | null
  /** Let the color be partly transparent. */
  showAlpha?: boolean
  /** Colors offered as one-click swatches. */
  presets?: string[]
  /** Show the hex value next to the swatch in the field. */
  showText?: boolean
  placeholder?: string
  size?: Size
  disabled?: boolean
  invalid?: boolean
  clearable?: boolean
  placement?: Placement
  teleport?: string | HTMLElement | false
}

export interface ColorPickerEmits {
  /** Fires while dragging, so the color can be previewed live. */
  'update:modelValue': [value: string | null]
  /** The color settled: the panel closed with a new value. */
  change: [value: string | null]
}

export interface ColorPickerExpose {
  focus: () => void
  blur: () => void
}
