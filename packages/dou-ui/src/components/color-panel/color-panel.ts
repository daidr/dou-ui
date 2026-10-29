import type { ColorFormat, ColorGamut, ColorSpace } from '../color-picker/color'

/**
 * How the panel picks a color: `square` is a saturation / brightness
 * square with a hue track, `wheel` a hue / saturation wheel with a
 * brightness track, and a color space name gives one slider per channel
 * of that space.
 */
export type ColorPanelMode = 'square' | 'wheel' | ColorSpace

export interface ColorPanelProps {
  /** The color, in any supported format. Bound with `v-model`. */
  modelValue?: string | null
  /** The text format the panel writes back to `v-model`. */
  format?: ColorFormat
  /** How the panel picks a color. A list shows a switcher on top. */
  panel?: ColorPanelMode | ColorPanelMode[]
  /**
   * `srgb` maps colors outside sRGB back into it; `none` lets the Lab
   * formats and panels keep them, for wide gamut screens.
   */
  gamut?: ColorGamut
  /** Let the color be partly transparent. */
  showAlpha?: boolean
  /** Colors offered as one-click swatches, in any supported format. */
  presets?: string[]
  /** Show the format menu and the text box under the panel. */
  showInput?: boolean
  /** Draw a border and background around the panel, for use in a page. */
  bordered?: boolean
  disabled?: boolean
}

export interface ColorPanelEmits {
  /** Fires while dragging, so the color can be previewed live. */
  'update:modelValue': [value: string | null]
  /** The color settled: a drag ended, a value was typed or a preset picked. */
  change: [value: string | null]
}

export interface ColorPanelExpose {
  /** Focus the first slider. */
  focus: () => void
}
