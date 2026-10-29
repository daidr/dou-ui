import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'
import type { ColorPanelMode } from '../color-panel/color-panel'
import type { ColorFormat, ColorGamut, ColorSpace } from './color'

export type { ColorFormat, ColorGamut, ColorSpace }

/** How the panel picks a color; see `ColorPanelMode`. */
export type ColorPickerPanel = ColorPanelMode

export interface ColorPickerProps {
  /** The color, in any supported format. Bound with `v-model`. */
  modelValue?: string | null
  /** The text format the picker writes back to `v-model`. */
  format?: ColorFormat
  /** How the panel picks a color. A list shows a switcher on top of the panel. */
  panel?: ColorPickerPanel | ColorPickerPanel[]
  /**
   * `srgb` maps colors outside sRGB back into it; `none` lets the Lab
   * formats and panels keep them, for wide gamut screens.
   */
  gamut?: ColorGamut
  /** Let the color be partly transparent. */
  showAlpha?: boolean
  /** Colors offered as one-click swatches, in any supported format. */
  presets?: string[]
  /** Show the value next to the swatch in the field. */
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
