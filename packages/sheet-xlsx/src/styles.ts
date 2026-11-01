import type { SheetStyle } from '@dou-ui/sheet/core'
import { attrs, esc, HEAD, NS } from './xml'

/** A color as the file writes it, `FFRRGGBB`; `undefined` for colors it can't write. */
export function argb(color: string | undefined) {
  if (!color) return undefined
  let hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1]
  if (!hex) return undefined
  if (hex.length === 3) hex = [...hex].map((d) => d + d).join('')
  return `FF${hex.toUpperCase()}`
}

const BUILTIN_FORMATS: Record<string, number> = {
  General: 0,
  '0': 1,
  '0.00': 2,
  '#,##0': 3,
  '#,##0.00': 4,
  '0%': 9,
  '0.00%': 10,
  '0.00E+00': 11,
  '@': 49,
}

/** A look as the file keeps it: a style in plain colors and a number format. */
export interface CellLook {
  style?: SheetStyle
  format?: string
  /** Text that reads as a formula, kept as text when edited in other programs. */
  quote?: boolean
}

/** A list element with its count, `''` when empty. */
const list = (tag: string, items: string[]) =>
  items.length ? `<${tag} count="${items.length}">${items.join('')}</${tag}>` : ''

/**
 * The file's style sheet, built up as cells ask for looks: each different
 * look is written once and cells refer to it by number.
 */
export class StyleSheet {
  private formats = new Map<string, number>()
  private fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>']
  private fontIds = new Map<string, number>([[this.fonts[0]!, 0]])
  private fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ]
  private fillIds = new Map<string, number>()
  private xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']
  private xfIds = new Map<string, number>([[this.xfs[0]!, 0]])
  private dxfs: string[] = []
  private dxfIds = new Map<string, number>()

  /** The number of a look, `0` for the plain one. */
  look({ style, format, quote }: CellLook) {
    const numFmtId = format ? this.format(format) : 0
    const fontId = style ? this.font(style) : 0
    const fillId = style ? this.fill(argb(style.background)) : 0
    const align =
      style && (style.align || style.valign || style.wrap)
        ? `<alignment${attrs({
            horizontal: style.align,
            vertical: style.valign === 'middle' ? 'center' : style.valign,
            wrapText: style.wrap,
          })}/>`
        : ''
    // cells are locked unless their style says otherwise
    const open = style?.locked === false ? '<protection locked="0"/>' : ''
    const inner = align + open
    const xf = `<xf${attrs({
      numFmtId,
      fontId,
      fillId,
      borderId: 0,
      xfId: 0,
      applyNumberFormat: numFmtId ? 1 : undefined,
      applyFont: fontId ? 1 : undefined,
      applyFill: fillId ? 1 : undefined,
      applyAlignment: align ? 1 : undefined,
      applyProtection: open ? 1 : undefined,
      quotePrefix: quote,
    })}${inner ? `>${inner}</xf>` : '/>'}`
    let id = this.xfIds.get(xf)
    if (id == null) {
      id = this.xfs.push(xf) - 1
      this.xfIds.set(xf, id)
    }
    return id
  }

  /** The number of a conditional format's look. */
  differential(style: SheetStyle) {
    const font = fontParts(style)
    const fill = argb(style.background)
    const dxf = `<dxf>${font ? `<font>${font}</font>` : ''}${
      fill
        ? `<fill><patternFill patternType="solid"><bgColor rgb="${fill}"/></patternFill></fill>`
        : ''
    }</dxf>`
    let id = this.dxfIds.get(dxf)
    if (id == null) {
      id = this.dxfs.push(dxf) - 1
      this.dxfIds.set(dxf, id)
    }
    return id
  }

  private format(code: string) {
    const builtin = BUILTIN_FORMATS[code]
    if (builtin != null) return builtin
    let id = this.formats.get(code)
    if (id == null) {
      id = 164 + this.formats.size
      this.formats.set(code, id)
    }
    return id
  }

  private font(style: SheetStyle) {
    const parts = fontParts(style)
    if (!parts) return 0
    const font = `<font>${parts}<sz val="11"/><name val="Calibri"/><family val="2"/></font>`
    let id = this.fontIds.get(font)
    if (id == null) {
      id = this.fonts.push(font) - 1
      this.fontIds.set(font, id)
    }
    return id
  }

  private fill(color: string | undefined) {
    if (!color) return 0
    let id = this.fillIds.get(color)
    if (id == null) {
      id =
        this.fills.push(
          `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`,
        ) - 1
      this.fillIds.set(color, id)
    }
    return id
  }

  toXML() {
    const formats = [...this.formats].map(
      ([code, id]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`,
    )
    return (
      `${HEAD}<styleSheet xmlns="${NS}">` +
      list('numFmts', formats) +
      list('fonts', this.fonts) +
      list('fills', this.fills) +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      list('cellXfs', this.xfs) +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      `<dxfs count="${this.dxfs.length}">${this.dxfs.join('')}</dxfs>` +
      '</styleSheet>'
    )
  }
}

/** A style's font parts, in the order the file keeps them; `''` for none. */
function fontParts(style: SheetStyle) {
  const color = argb(style.color)
  return (
    (style.bold ? '<b/>' : '') +
    (style.italic ? '<i/>' : '') +
    (style.strike ? '<strike/>' : '') +
    (color ? `<color rgb="${color}"/>` : '') +
    (style.underline ? '<u/>' : '')
  )
}
