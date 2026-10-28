import type { Locale } from '../../locale/types'
import type { ColorSpace } from './color'

type ChannelName = keyof Locale['colorPicker']

/** A slider in the channel panel. Values are in the space's own units. */
export interface Channel {
  /** The short label next to the slider. */
  label: string
  /** The locale key naming it for screen readers. */
  name: ChannelName
  min: number
  max: number
  /** What the value is multiplied by for display, e.g. 255 for sRGB. */
  scale: number
  digits: number
  unit?: string
}

const hue: Channel = { label: 'H', name: 'hue', min: 0, max: 360, scale: 1, digits: 1, unit: '°' }
const percent = (label: string, name: ChannelName): Channel => ({
  label,
  name,
  min: 0,
  max: 1,
  scale: 100,
  digits: 1,
  unit: '%',
})
const byte = (label: string, name: ChannelName): Channel => ({
  label,
  name,
  min: 0,
  max: 1,
  scale: 255,
  digits: 0,
})

export const CHANNELS: Record<ColorSpace, [Channel, Channel, Channel]> = {
  rgb: [byte('R', 'red'), byte('G', 'green'), byte('B', 'blue')],
  hsl: [hue, percent('S', 'saturation'), percent('L', 'lightness')],
  hsv: [hue, percent('S', 'saturation'), percent('V', 'brightness')],
  hwb: [hue, percent('W', 'whiteness'), percent('B', 'blackness')],
  lab: [
    { label: 'L', name: 'lightness', min: 0, max: 100, scale: 1, digits: 2 },
    { label: 'a', name: 'axisA', min: -125, max: 125, scale: 1, digits: 2 },
    { label: 'b', name: 'axisB', min: -125, max: 125, scale: 1, digits: 2 },
  ],
  lch: [
    { label: 'L', name: 'lightness', min: 0, max: 100, scale: 1, digits: 2 },
    { label: 'C', name: 'chroma', min: 0, max: 150, scale: 1, digits: 2 },
    { ...hue, digits: 2 },
  ],
  oklab: [
    { label: 'L', name: 'lightness', min: 0, max: 1, scale: 1, digits: 3 },
    { label: 'a', name: 'axisA', min: -0.4, max: 0.4, scale: 1, digits: 3 },
    { label: 'b', name: 'axisB', min: -0.4, max: 0.4, scale: 1, digits: 3 },
  ],
  oklch: [
    { label: 'L', name: 'lightness', min: 0, max: 1, scale: 1, digits: 3 },
    { label: 'C', name: 'chroma', min: 0, max: 0.4, scale: 1, digits: 3 },
    { ...hue, digits: 2 },
  ],
}

export const ALPHA: Channel = percent('A', 'alpha')

/** The name shown for a format or space: `HEX`, `RGB`, `OKLCH`… */
export const formatLabel = (format: string) => format.toUpperCase()
