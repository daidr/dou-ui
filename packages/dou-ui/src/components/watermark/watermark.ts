export interface WatermarkFont {
  /** In px. Defaults to `14`. */
  size?: number
  /** Defaults to `400`. */
  weight?: number | string
  /** Defaults to the font of the container. */
  family?: string
  style?: 'normal' | 'italic'
}

export interface WatermarkProps {
  /** The text; an array draws one line each. */
  content?: string | string[]
  /** An image URL drawn instead of text. Loaded with `crossorigin="anonymous"`. */
  image?: string
  /** Width of one mark, in px. Text defaults to its own width; images to `120`. */
  width?: number
  /** Height of one mark, in px. Text defaults to its own height; images to `64`. */
  height?: number
  /** Rotation in degrees. Defaults to `-22`. */
  rotate?: number
  /** Space between marks, `[x, y]` in px. Defaults to `[100, 100]`. */
  gap?: [number, number]
  /** Shift every other row by half a step, so marks don't line up in columns. */
  staggered?: boolean
  font?: WatermarkFont
  /** Color of text marks. Defaults to the theme's text color. */
  color?: string
  /** Opacity of the whole layer. Defaults to `0.12`. */
  opacity?: number
  /** Cover the viewport instead of the container. */
  fullscreen?: boolean
  /** Stacking order of the layer over the content. Defaults to `9`. */
  zIndex?: number
  /** Redraw the layer when it is removed or its attributes are edited in the page. */
  protect?: boolean
}

export interface WatermarkSlots {
  /** The content the marks cover. */
  default?: () => unknown
}
