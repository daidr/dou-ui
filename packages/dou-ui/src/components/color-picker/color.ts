/*
 * Color math for the picker: parsing and printing the text formats,
 * converting between color spaces and mapping colors into sRGB.
 *
 * A color is a space plus three coordinates and an alpha. Coordinates
 * use each space's natural units:
 *
 *   rgb    r, g, b in 0–1 (gamma encoded sRGB)
 *   hsl    h in degrees, s and l in 0–1
 *   hsv    h in degrees, s and v in 0–1
 *   hwb    h in degrees, w and b in 0–1
 *   lab    L in 0–100, a and b around ±125 (CIE Lab, D50)
 *   lch    L in 0–100, C from 0 (about 150 at most), h in degrees
 *   oklab  L in 0–1, a and b around ±0.4
 *   oklch  L in 0–1, C from 0 (about 0.4 at most), h in degrees
 *
 * Conversions go through linear-light sRGB, which is left unbounded so
 * colors outside sRGB survive a round trip between the Lab spaces.
 */

export type ColorSpace = 'rgb' | 'hsl' | 'hsv' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch'
export type ColorFormat = 'hex' | ColorSpace
/** `srgb` maps every color into sRGB; `none` keeps Lab colors as they are. */
export type ColorGamut = 'srgb' | 'none'

export type Coords = [number, number, number]

export interface Color {
  space: ColorSpace
  coords: Coords
  /** 0–1 */
  alpha: number
}

export const COLOR_FORMATS: ColorFormat[] = [
  'hex',
  'rgb',
  'hsl',
  'hsv',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
]

const SRGB_SPACES = new Set<ColorSpace>(['rgb', 'hsl', 'hsv', 'hwb'])
/** Spaces with a hue, and which coordinate holds it. */
const HUE_INDEX: Partial<Record<ColorSpace, number>> = { hsl: 0, hsv: 0, hwb: 0, lch: 2, oklch: 2 }

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const mod360 = (value: number) => ((value % 360) + 360) % 360

type Matrix = [Coords, Coords, Coords]
const multiply = (m: Matrix, [x, y, z]: Coords): Coords => [
  m[0][0] * x + m[0][1] * y + m[0][2] * z,
  m[1][0] * x + m[1][1] * y + m[1][2] * z,
  m[2][0] * x + m[2][1] * y + m[2][2] * z,
]

/* sRGB and its cylindrical forms */

const decode = (c: number) => {
  const abs = Math.abs(c)
  return Math.sign(c) * (abs <= 0.04045 ? abs / 12.92 : ((abs + 0.055) / 1.055) ** 2.4)
}
const encode = (c: number) => {
  const abs = Math.abs(c)
  return Math.sign(c) * (abs <= 0.0031308 ? abs * 12.92 : 1.055 * abs ** (1 / 2.4) - 0.055)
}

function rgbHue(r: number, g: number, b: number, max: number, delta: number) {
  if (!delta) return 0
  let h: number
  if (max === r) h = ((g - b) / delta) % 6
  else if (max === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4
  return mod360(h * 60)
}

function rgbToHsv([r, g, b]: Coords): Coords {
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  return [rgbHue(r, g, b, max, delta), max ? delta / max : 0, max]
}

function hsvToRgb([h, s, v]: Coords): Coords {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5), f(3), f(1)]
}

function rgbToHsl([r, g, b]: Coords): Coords {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0
  return [rgbHue(r, g, b, max, delta), clamp(s), l]
}

function hslToRgb([h, s, l]: Coords): Coords {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

function rgbToHwb(rgb: Coords): Coords {
  const [h] = rgbToHsv(rgb)
  return [h, Math.min(...rgb), 1 - Math.max(...rgb)]
}

function hwbToRgb([h, w, b]: Coords): Coords {
  if (w + b >= 1) {
    const gray = w / (w + b)
    return [gray, gray, gray]
  }
  return hsvToRgb([h, 1, 1]).map((c) => c * (1 - w - b) + w) as Coords
}

/* Lab, through CIE XYZ */

const LIN_TO_XYZ65: Matrix = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
]
const XYZ65_TO_LIN: Matrix = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
]
const D65_TO_D50: Matrix = [
  [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
  [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
  [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008],
]
const D50_TO_D65: Matrix = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
]
const D50_WHITE: Coords = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585]
const EPSILON = 216 / 24389
const KAPPA = 24389 / 27

function linToLab(lin: Coords): Coords {
  const xyz = multiply(D65_TO_D50, multiply(LIN_TO_XYZ65, lin))
  const [fx, fy, fz] = xyz.map((value, i) => {
    const t = value / D50_WHITE[i]!
    return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116
  }) as Coords
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function labToLin([l, a, b]: Coords): Coords {
  const fy = (l + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200
  const xyz: Coords = [
    (fx ** 3 > EPSILON ? fx ** 3 : (116 * fx - 16) / KAPPA) * D50_WHITE[0],
    (l > KAPPA * EPSILON ? fy ** 3 : l / KAPPA) * D50_WHITE[1],
    (fz ** 3 > EPSILON ? fz ** 3 : (116 * fz - 16) / KAPPA) * D50_WHITE[2],
  ]
  return multiply(XYZ65_TO_LIN, multiply(D50_TO_D65, xyz))
}

/* Oklab, straight from linear sRGB */

const LIN_TO_LMS: Matrix = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
]
const LMS_TO_OKLAB: Matrix = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
]
const OKLAB_TO_LMS: Matrix = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
]
const LMS_TO_LIN: Matrix = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
]

const linToOklab = (lin: Coords) =>
  multiply(LMS_TO_OKLAB, multiply(LIN_TO_LMS, lin).map(Math.cbrt) as Coords)
const oklabToLin = (lab: Coords) =>
  multiply(LMS_TO_LIN, multiply(OKLAB_TO_LMS, lab).map((c) => c ** 3) as Coords)

/* polar forms */

const toPolar = ([l, a, b]: Coords): Coords => [
  l,
  Math.hypot(a, b),
  mod360((Math.atan2(b, a) * 180) / Math.PI),
]
const fromPolar = ([l, c, h]: Coords): Coords => {
  const rad = (h * Math.PI) / 180
  return [l, c * Math.cos(rad), c * Math.sin(rad)]
}

/* conversion */

function toLinear({ space, coords }: Color): Coords {
  switch (space) {
    case 'rgb':
      return coords.map(decode) as Coords
    case 'hsl':
      return hslToRgb(coords).map(decode) as Coords
    case 'hsv':
      return hsvToRgb(coords).map(decode) as Coords
    case 'hwb':
      return hwbToRgb(coords).map(decode) as Coords
    case 'lab':
      return labToLin(coords)
    case 'lch':
      return labToLin(fromPolar(coords))
    case 'oklab':
      return oklabToLin(coords)
    case 'oklch':
      return oklabToLin(fromPolar(coords))
  }
}

function fromLinear(lin: Coords, space: ColorSpace): Coords {
  const rgb = () => lin.map(encode) as Coords
  switch (space) {
    case 'rgb':
      return rgb()
    case 'hsl':
      return rgbToHsl(rgb())
    case 'hsv':
      return rgbToHsv(rgb())
    case 'hwb':
      return rgbToHwb(rgb())
    case 'lab':
      return linToLab(lin)
    case 'lch':
      return toPolar(linToLab(lin))
    case 'oklab':
      return linToOklab(lin)
    case 'oklch':
      return toPolar(linToOklab(lin))
  }
}

/** Whether the color has no hue to speak of (a gray), in its own space. */
export function isAchromatic({ space, coords }: Color): boolean {
  switch (space) {
    case 'hsl':
      return coords[1] < 1e-6 || coords[2] < 1e-6 || coords[2] > 1 - 1e-6
    case 'hsv':
      return coords[1] < 1e-6 || coords[2] < 1e-6
    case 'hwb':
      return coords[1] + coords[2] > 1 - 1e-6
    case 'lch':
      return coords[1] < 0.02
    case 'oklch':
      return coords[1] < 2e-5
    default:
      return false
  }
}

export const hueIndex = (space: ColorSpace) => HUE_INDEX[space]

/**
 * Express the color in another space. A gray has no hue, so the hue is
 * carried over from `hueFrom` when given (the hue the user last picked).
 */
export function convert(color: Color, space: ColorSpace, hueFrom?: number): Color {
  if (color.space === space) return color
  const coords = fromLinear(toLinear(color), space)
  const result: Color = { space, coords, alpha: color.alpha }
  const index = HUE_INDEX[space]
  if (index !== undefined && hueFrom !== undefined && isAchromatic(result)) coords[index] = hueFrom
  return result
}

/** The color's hue, if its space has one. */
export function hueOf({ space, coords }: Color): number | undefined {
  const index = HUE_INDEX[space]
  return index === undefined ? undefined : coords[index]
}

/* gamut mapping */

const inUnit = (rgb: Coords) => rgb.every((c) => c >= -1e-5 && c <= 1 + 1e-5)
const clip = (rgb: Coords) => rgb.map((c) => clamp(c)) as Coords

function deltaEOK(a: Coords, b: Coords) {
  const [x, y] = [linToOklab(a.map(decode) as Coords), linToOklab(b.map(decode) as Coords)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

export function inSrgb(color: Color): boolean {
  return SRGB_SPACES.has(color.space) || inUnit(toLinear(color).map(encode) as Coords)
}

/**
 * The color as gamma encoded sRGB in 0–1. A color outside sRGB loses
 * chroma at constant lightness and hue in Oklch until clipping it would
 * no longer be noticed (the CSS Color 4 gamut mapping).
 */
export function toSrgb(color: Color): Coords {
  const rgb = convert(color, 'rgb').coords
  if (SRGB_SPACES.has(color.space) || inUnit(rgb)) return clip(rgb)
  const [l, c, h] = convert(color, 'oklch').coords
  if (l >= 1) return [1, 1, 1]
  if (l <= 0) return [0, 0, 0]
  const at = (chroma: number) =>
    convert({ space: 'oklch', coords: [l, chroma, h], alpha: 1 }, 'rgb')
  const JND = 0.02
  let clipped = clip(rgb)
  if (deltaEOK(clipped, rgb) < JND) return clipped
  let min = 0
  let max = c
  let minInGamut = true
  while (max - min > 1e-4) {
    const chroma = (min + max) / 2
    const current = at(chroma).coords
    if (minInGamut && inUnit(current)) {
      min = chroma
      continue
    }
    clipped = clip(current)
    const e = deltaEOK(clipped, current)
    if (e < JND) {
      if (JND - e < 1e-4) return clipped
      minInGamut = false
      min = chroma
    } else max = chroma
  }
  return clipped
}

/** Map into sRGB when needed, keeping the color's own space. */
export function toGamut(color: Color, gamut: ColorGamut): Color {
  if (gamut === 'none' || inSrgb(color)) return color
  const mapped = convert({ space: 'rgb', coords: toSrgb(color), alpha: color.alpha }, color.space)
  const index = HUE_INDEX[color.space]
  if (index !== undefined && isAchromatic(mapped)) mapped.coords[index] = color.coords[index]!
  return mapped
}

/* parsing */

const FUNCTION = /^(rgba?|hsla?|hsva?|hwb|lab|lch|oklab|oklch)\(\s*([^()]*?)\s*\)$/i

function parseAngle(token: string): number {
  const match = /^([+-]?[\d.]+(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/i.exec(token)
  if (!match) return NaN
  const value = Number(match[1])
  switch (match[2]?.toLowerCase()) {
    case 'grad':
      return (value * 360) / 400
    case 'rad':
      return (value * 180) / Math.PI
    case 'turn':
      return value * 360
    default:
      return value
  }
}

/** A number, or a percentage of `full`. `none` is zero. */
function parseNumber(token: string, full: number): number {
  if (token.toLowerCase() === 'none') return 0
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?%?$/i.test(token)) return NaN
  return token.endsWith('%') ? (parseFloat(token) / 100) * full : parseFloat(token)
}

/** What 100% means for each coordinate, and how to read it. */
const CHANNELS: Record<ColorSpace, [number | 'hue', number | 'hue', number | 'hue']> = {
  rgb: [255, 255, 255],
  hsl: ['hue', 100, 100],
  hsv: ['hue', 100, 100],
  hwb: ['hue', 100, 100],
  lab: [100, 125, 125],
  lch: [100, 150, 'hue'],
  oklab: [1, 0.4, 0.4],
  oklch: [1, 0.4, 'hue'],
}

function parseHex(text: string): Color | null {
  let hex = text.replace(/^#/, '').toLowerCase()
  if (!/^([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.test(hex)) return null
  if (hex.length <= 4) hex = [...hex].map((char) => char + char).join('')
  const channel = (index: number) => parseInt(hex.slice(index * 2, index * 2 + 2), 16) / 255
  return {
    space: 'rgb',
    coords: [channel(0), channel(1), channel(2)],
    alpha: hex.length === 8 ? channel(3) : 1,
  }
}

/**
 * Read a color in any of the formats: hex (`#rgb`, `#rgba`, `#rrggbb`,
 * `#rrggbbaa`, the `#` optional), or `rgb()`, `hsl()`, `hsv()`, `hwb()`,
 * `lab()`, `lch()`, `oklab()` or `oklch()` in the space separated syntax
 * (`rgb(63 86 181 / 0.5)`) or the comma separated one (`rgba(63, 86, 181, 0.5)`).
 */
export function parseColor(input: string): Color | null {
  const text = input.trim()
  const match = FUNCTION.exec(text)
  if (!match) return parseHex(text)
  // `rgba()`, `hsla()` and `hsva()` are the same as without the `a`.
  const space = match[1]!.toLowerCase().replace(/a$/, '') as ColorSpace
  const tokens = match[2]!.split(/\s*[,/]\s*|\s+/).filter(Boolean)
  if (tokens.length !== 3 && tokens.length !== 4) return null
  const coords = CHANNELS[space].map((full, i) =>
    full === 'hue'
      ? tokens[i] === 'none'
        ? 0
        : parseAngle(tokens[i]!)
      : parseNumber(tokens[i]!, full),
  ) as Coords
  const alpha = tokens[3] === undefined ? 1 : parseNumber(tokens[3], 1)
  if (coords.some(Number.isNaN) || Number.isNaN(alpha)) return null
  const color: Color = { space, coords, alpha: clamp(alpha) }
  return normalize(color)
}

/** Keep coordinates in range: hues in 0–360, sRGB in 0–1, chroma not negative. */
function normalize(color: Color): Color {
  const [x, y, z] = color.coords
  switch (color.space) {
    case 'rgb':
      color.coords = [clamp(x / 255), clamp(y / 255), clamp(z / 255)]
      break
    case 'hsl':
    case 'hsv':
    case 'hwb':
      color.coords = [mod360(x), clamp(y / 100), clamp(z / 100)]
      break
    case 'lab':
      color.coords = [clamp(x, 0, 100), y, z]
      break
    case 'lch':
      color.coords = [clamp(x, 0, 100), Math.max(0, y), mod360(z)]
      break
    case 'oklab':
      color.coords = [clamp(x), y, z]
      break
    case 'oklch':
      color.coords = [clamp(x), Math.max(0, y), mod360(z)]
      break
  }
  return color
}

/* printing */

/** Round to `digits` decimals, dropping trailing zeros and negative zero. */
const fixed = (value: number, digits: number) => String(Number(value.toFixed(digits)) || 0)
const hex2 = (value: number) =>
  Math.round(clamp(value) * 255)
    .toString(16)
    .padStart(2, '0')

/** How each coordinate is printed: scale, decimals and unit. */
const PRINT: Record<ColorSpace, [number, number, string][]> = {
  rgb: [
    [255, 0, ''],
    [255, 0, ''],
    [255, 0, ''],
  ],
  hsl: [
    [1, 1, ''],
    [100, 1, '%'],
    [100, 1, '%'],
  ],
  hsv: [
    [1, 1, ''],
    [100, 1, '%'],
    [100, 1, '%'],
  ],
  hwb: [
    [1, 1, ''],
    [100, 1, '%'],
    [100, 1, '%'],
  ],
  lab: [
    [1, 2, ''],
    [1, 2, ''],
    [1, 2, ''],
  ],
  lch: [
    [1, 2, ''],
    [1, 2, ''],
    [1, 2, ''],
  ],
  oklab: [
    [1, 4, ''],
    [1, 4, ''],
    [1, 4, ''],
  ],
  oklch: [
    [1, 4, ''],
    [1, 4, ''],
    [1, 2, ''],
  ],
}

/** The coordinates of a color in a space, ready for printing or a panel. */
export function coordsIn(color: Color, space: ColorSpace, gamut: ColorGamut): Coords {
  const fitted = toGamut(color, gamut)
  if (fitted.space === space) return fitted.coords
  const source: Color =
    SRGB_SPACES.has(space) && !SRGB_SPACES.has(fitted.space)
      ? { space: 'rgb', coords: toSrgb(fitted), alpha: fitted.alpha }
      : fitted
  return convert(source, space, hueOf(color)).coords
}

/**
 * Print a color. Formats other than the Lab family can only hold sRGB,
 * so the color is mapped into sRGB for them whatever the `gamut`.
 * `alpha: false` drops the alpha channel.
 */
export function formatColor(
  color: Color,
  format: ColorFormat,
  { alpha = true, gamut = 'srgb' }: { alpha?: boolean; gamut?: ColorGamut } = {},
): string {
  const a = alpha ? clamp(color.alpha) : 1
  if (format === 'hex') {
    const [r, g, b] = toSrgb(color)
    return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 1 ? hex2(a) : ''}`
  }
  const coords = coordsIn(color, format, gamut)
  const body = coords
    .map((value, i) => {
      const [scale, digits, unit] = PRINT[format][i]!
      // A hue that rounds up to 360 is printed as 0.
      const rounded = i === HUE_INDEX[format] ? Number(value.toFixed(digits)) % 360 : value * scale
      return fixed(rounded, digits) + unit
    })
    .join(' ')
  return `${format}(${body}${a < 1 ? ` / ${fixed(a, 3)}` : ''})`
}

/** The opaque color as CSS, for painting swatches, thumbs and tracks. */
export function toCss(color: Color, gamut: ColorGamut = 'srgb', alpha = false): string {
  if (gamut === 'none' && !SRGB_SPACES.has(color.space) && !inSrgb(color))
    return formatColor(color, color.space, { alpha, gamut })
  return formatColor(color, 'hex', { alpha })
}
