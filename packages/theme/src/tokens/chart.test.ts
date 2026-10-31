import { describe, expect, it } from 'vitest'
import { contrastRatio, parseColor } from './create'
import { dark } from './dark'
import { light } from './light'
import type { ThemeTokens } from './types'

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

// Color-vision deficiency simulation (severity 1), on linear RGB.
const deficiencies: Record<string, number[][]> = {
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
}

type Rgb = number[]
const simulate = (rgb: Rgb, matrix: number[][]) => {
  const lin = rgb.map(linear)
  return matrix.map((row) =>
    Math.min(1, Math.max(0, gamma(row[0]! * lin[0]! + row[1]! * lin[1]! + row[2]! * lin[2]!))),
  )
}

const oklab = (rgb: Rgb) => {
  const [r, g, b] = rgb.map(linear) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
const distance = (a: Rgb, b: Rgb) => {
  const [x, y] = [oklab(a), oklab(b)]
  return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!)
}

describe.each([
  ['light', light],
  ['dark', dark],
] as Array<[string, ThemeTokens]>)('%s chart palette', (_, theme) => {
  const colors = Object.values(theme.color.chart)

  it('has eight colors', () => {
    expect(colors).toHaveLength(8)
  })

  it('reads against the surface (3:1 for graphics)', () => {
    for (const color of colors)
      expect(contrastRatio(color, theme.color.bg.surface)).toBeGreaterThanOrEqual(3)
  })

  it('keeps every pair apart, also for red-green deficiencies', () => {
    const rgb = colors.map(parseColor)
    for (const matrix of [null, ...Object.values(deficiencies)]) {
      const seen = matrix ? rgb.map((c) => simulate(c, matrix)) : rgb
      for (let i = 0; i < seen.length; i++)
        for (let j = i + 1; j < seen.length; j++)
          expect(distance(seen[i]!, seen[j]!)).toBeGreaterThan(0.05)
    }
  })
})
