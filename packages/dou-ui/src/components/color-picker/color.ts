/** Colors are hex strings: `#rrggbb`, or `#rrggbbaa` with an alpha channel. */

export interface Hsva {
  /** 0–360 */
  h: number
  /** 0–1 */
  s: number
  /** 0–1 */
  v: number
  /** 0–1 */
  a: number
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const hex2 = (value: number) =>
  Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, '0')

/** Read `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, with or without the `#`. */
export function parseHex(text: string): Hsva | null {
  let hex = text.trim().replace(/^#/, '').toLowerCase()
  if (!/^([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.test(hex)) return null
  if (hex.length <= 4) hex = [...hex].map((char) => char + char).join('')
  const channel = (index: number) => parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  const a = hex.length === 8 ? channel(3) / 255 : 1
  return { ...rgbToHsv(channel(0), channel(1), channel(2)), a }
}

export function toHex({ h, s, v, a }: Hsva, alpha: boolean): string {
  const [r, g, b] = hsvToRgb(h, s, v)
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`
  return alpha && a < 1 ? `${base}${hex2(a * 255)}` : base
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5) * 255, f(3) * 255, f(1) * 255]
}

export function rgbToHsv(r: number, g: number, b: number): Omit<Hsva, 'a'> {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const delta = max - Math.min(rn, gn, bn)
  let h = 0
  if (delta) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? delta / max : 0, v: max }
}

export { clamp }
