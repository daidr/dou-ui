import type { SheetStyle } from '@dou-ui/sheet/core'
import { childOf, childrenOf, isNotOff, isOff, isOn, type XmlNode } from './xml-read'

/** The 56 colors older files name by number, from 8; 0 to 7 are the first eight again. */
const PALETTE = [
  '000000',
  'FFFFFF',
  'FF0000',
  '00FF00',
  '0000FF',
  'FFFF00',
  'FF00FF',
  '00FFFF',
  '800000',
  '008000',
  '000080',
  '808000',
  '800080',
  '008080',
  'C0C0C0',
  '808080',
  '9999FF',
  '993366',
  'FFFFCC',
  'CCFFFF',
  '660066',
  'FF8080',
  '0066CC',
  'CCCCFF',
  '000080',
  'FF00FF',
  'FFFF00',
  '00FFFF',
  '800080',
  '800000',
  '008080',
  '0000FF',
  '00CCFF',
  'CCFFFF',
  'CCFFCC',
  'FFFF99',
  '99CCFF',
  'FF99CC',
  'CC99FF',
  'FFCC99',
  '3366FF',
  '33CCCC',
  '99CC00',
  'FFCC00',
  'FF9900',
  'FF6600',
  '666699',
  '969696',
  '003366',
  '339966',
  '003300',
  '333300',
  '993300',
  '993366',
  '333399',
  '333333',
]

/** The theme's colors in the order cells name them: light 1, dark 1, light 2, dark 2, accents, links. */
export function themeColors(theme: XmlNode | undefined) {
  const scheme = theme && findNode(theme, 'clrScheme')
  if (!scheme) return []
  const color = (name: string) => {
    const node = childOf(scheme, name)
    const value = childOf(node, 'srgbClr')?.attrs.val ?? childOf(node, 'sysClr')?.attrs.lastClr
    return value && /^[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : undefined
  }
  const order = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4']
  return [...order, 'accent5', 'accent6', 'hlink', 'folHlink'].map(color)
}

function findNode(node: XmlNode, name: string): XmlNode | undefined {
  if (node.name === name) return node
  for (const child of node.children) {
    const found = findNode(child, name)
    if (found) return found
  }
  return undefined
}

/** A channel of a color from its hue, as HSL works it out. */
const hue = (p: number, q: number, t: number) => {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

/** A color lighter (`tint` above 0) or darker, as the file's tints work: on its lightness. */
function tinted(hex: string, tint: number) {
  if (!tint) return hex
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  let l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h /= 6
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint
  let rgb: number[]
  if (!s) rgb = [l, l, l]
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    rgb = [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)]
  }
  return rgb
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, c)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()
}

/** A color element as `#rrggbb`; `undefined` for the automatic color or one the file doesn't say. */
export function colorOf(node: XmlNode | undefined, theme: (string | undefined)[]) {
  if (!node || isOn(node.attrs.auto)) return undefined
  const { rgb, indexed } = node.attrs
  let hex: string | undefined
  if (rgb && /^[0-9a-f]{6,8}$/i.test(rgb)) hex = rgb.slice(-6).toUpperCase()
  else if (node.attrs.theme != null) hex = theme[+node.attrs.theme]
  else if (indexed != null) hex = PALETTE[+indexed]
  if (!hex) return undefined
  const tint = Number(node.attrs.tint ?? 0)
  return `#${(Number.isFinite(tint) ? tinted(hex, tint) : hex).toLowerCase()}`
}

const BUILTIN_FORMATS: Record<number, string> = {
  1: '0',
  2: '0.00',
  3: '#,##0',
  4: '#,##0.00',
  9: '0%',
  10: '0.00%',
  11: '0.00E+00',
  12: '# ?/?',
  13: '# ??/??',
  14: 'yyyy-mm-dd',
  15: 'd-mmm-yy',
  16: 'd-mmm',
  17: 'mmm-yy',
  18: 'h:mm AM/PM',
  19: 'h:mm:ss AM/PM',
  20: 'hh:mm',
  21: 'hh:mm:ss',
  22: 'yyyy-mm-dd hh:mm',
  37: '#,##0 ;(#,##0)',
  38: '#,##0 ;[Red](#,##0)',
  39: '#,##0.00;(#,##0.00)',
  40: '#,##0.00;[Red](#,##0.00)',
  45: 'mm:ss',
  46: '[h]:mm:ss',
  47: 'mm:ss.0',
  48: '##0.0E+0',
  49: '@',
}
// formats each language's files give their own way of writing a date or time
for (const id of [27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54, 57, 58])
  BUILTIN_FORMATS[id] = 'yyyy-mm-dd'
for (const id of [32, 33, 55, 56]) BUILTIN_FORMATS[id] = 'hh:mm'

/** What a number format makes of a number: a date, a time, or a number. */
export function formatKind(code: string | undefined): 'date' | 'time' | 'number' {
  if (!code) return 'number'
  // quoted and escaped text, and colors and conditions in brackets, aren't parts
  const parts = code
    .split(';')[0]!
    .replace(/"[^"]*"|\\.|_.|\*./g, '')
    .replace(/\[(?![hms]+\])[^\]]*\]/gi, '')
  // elapsed time, such as `[h]:mm`, is shown on the number
  if (/\[[hms]+\]/i.test(parts)) return 'number'
  if (/[yd]/i.test(parts)) return 'date'
  if (/[hs]/i.test(parts)) return 'time'
  // months alone, such as `mmmm`
  if (/m/i.test(parts.replace(/General/gi, ''))) return 'date'
  return 'number'
}

/** A look a cell takes, by its style number. */
export interface CellLookIn {
  /** The style, in plain colors; `undefined` for none. */
  style?: SheetStyle
  /** Its key, the same for the same style. */
  key?: string
  /** The number format, `undefined` for General. */
  format?: string
  kind: 'date' | 'time' | 'number'
  /** Text that is kept as text even when it reads as a formula. */
  quote: boolean
  /** What it has that the sheet can't hold. */
  border: boolean
  font: boolean
}

const ALIGN: Record<string, SheetStyle['align']> = {
  left: 'left',
  center: 'center',
  centerContinuous: 'center',
  right: 'right',
}
// bottom is where other programs put text unless told otherwise, so it isn't kept as a style
const VALIGN: Record<string, SheetStyle['valign']> = {
  top: 'top',
  center: 'middle',
}

/** A font's parts as a style: bold, italic, underline, strike and its color unless it is the usual one. */
function fontStyle(font: XmlNode | undefined, theme: (string | undefined)[], usual?: string) {
  const style: SheetStyle = {}
  if (!font) return style
  const on = (name: string) => {
    const node = childOf(font, name)
    return !!node && isNotOff(node.attrs.val) && node.attrs.val !== 'none'
  }
  if (on('b')) style.bold = true
  if (on('i')) style.italic = true
  if (on('u')) style.underline = true
  if (on('strike')) style.strike = true
  const color = colorOf(childOf(font, 'color'), theme)
  if (color && color !== usual && color !== '#000000') style.color = color
  return style
}

/** A fill's color; `undefined` for no fill. */
function fillColor(fill: XmlNode | undefined, theme: (string | undefined)[], differential = false) {
  const pattern = childOf(fill, 'patternFill')
  if (!pattern) return undefined
  const type = pattern.attrs.patternType
  // a conditional format's solid fill gives its color as the background one
  if (differential)
    return colorOf(childOf(pattern, 'bgColor') ?? childOf(pattern, 'fgColor'), theme)
  if (!type || type === 'none' || type === 'gray125') return undefined
  return colorOf(childOf(pattern, 'fgColor') ?? childOf(pattern, 'bgColor'), theme)
}

const hasBorder = (border: XmlNode | undefined) =>
  !!border && border.children.some((side) => side.attrs.style && side.attrs.style !== 'none')

const sizeOf = (font: XmlNode | undefined) => childOf(font, 'sz')?.attrs.val

/** The looks of the file's cells and conditional formats, from its style sheet. */
export function readStyles(sheet: XmlNode | undefined, theme: (string | undefined)[]) {
  const formats = new Map<number, string>()
  for (const node of childrenOf(childOf(sheet, 'numFmts'), 'numFmt'))
    formats.set(+node.attrs.numFmtId!, node.attrs.formatCode ?? '')
  const fonts = childrenOf(childOf(sheet, 'fonts'), 'font')
  const fills = childrenOf(childOf(sheet, 'fills'), 'fill')
  const borders = childrenOf(childOf(sheet, 'borders'), 'border')
  const usualFont = fonts[0]
  const usualColor = colorOf(childOf(usualFont, 'color'), theme)

  const looks: CellLookIn[] = childrenOf(childOf(sheet, 'cellXfs'), 'xf').map((xf) => {
    const id = +(xf.attrs.numFmtId ?? 0)
    const code = formats.get(id) ?? BUILTIN_FORMATS[id]
    // escaped characters that read the same without the escape, as some programs write them
    const format = code && code !== 'General' ? code.replace(/\\([-\s/:.,()])/g, '$1') : undefined
    const font = fonts[+(xf.attrs.fontId ?? 0)]
    const style = fontStyle(font, theme, usualColor)
    const background = fillColor(fills[+(xf.attrs.fillId ?? 0)], theme)
    if (background) style.background = background
    const alignment = childOf(xf, 'alignment')
    if (alignment) {
      const align = ALIGN[alignment.attrs.horizontal ?? '']
      const valign = VALIGN[alignment.attrs.vertical ?? '']
      if (align) style.align = align
      if (valign) style.valign = valign
      if (isOn(alignment.attrs.wrapText)) style.wrap = true
    }
    // cells are locked unless this says otherwise
    const protection = childOf(xf, 'protection')
    if (protection && isOff(protection.attrs.locked)) style.locked = false
    const plain = !Object.keys(style).length
    return {
      style: plain ? undefined : style,
      key: plain ? undefined : JSON.stringify(style),
      format,
      kind: formatKind(format),
      quote: isOn(xf.attrs.quotePrefix),
      border: hasBorder(borders[+(xf.attrs.borderId ?? 0)]),
      // a size of its own; typefaces differ between computers anyway, so they aren't counted
      font: !!font && sizeOf(font) != null && sizeOf(font) !== sizeOf(usualFont),
    }
  })

  const differentials = childrenOf(childOf(sheet, 'dxfs'), 'dxf').map((dxf) => {
    const style = fontStyle(childOf(dxf, 'font'), theme)
    const background = fillColor(childOf(dxf, 'fill'), theme, true)
    if (background) style.background = background
    return style
  })
  return { looks, differentials }
}
