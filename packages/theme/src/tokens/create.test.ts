import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  createTheme,
  createTone,
  dark,
  defineTheme,
  light,
  mixColors,
  parseColor,
} from '../index'

const tones = ['neutral', 'primary', 'success', 'warning', 'danger'] as const

// the neutral leanings of the theme editor (docs/.vitepress/theme/components/DocThemeEditor.vue)
const leanings = [
  { hue: 0, chroma: 0 },
  { hue: 75, chroma: 0.008 },
  { hue: 255, chroma: 0.01 },
]

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

function tint(hex: string, hue: number, chroma: number): string {
  const [r, g, b] = parseColor(hex).map(linear) as [number, number, number]
  const L =
    0.2104542553 * Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) +
    0.793617785 * Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) -
    0.0040720468 * Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  // fade the tint out toward white and black, where it would leave the gamut
  const c = chroma * Math.min(1, (1 - L) * 8, L * 4)
  const h = (hue * Math.PI) / 180
  const A = c * Math.cos(h)
  const B = c * Math.sin(h)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, gamma(v))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

describe('createTheme', () => {
  it('keeps text readable in both themes for any brand color', () => {
    for (const color of [
      '#7c3aed',
      '#f59e0b',
      '#10b981',
      '#e11d48',
      '#0ea5e9',
      '#facc15',
      '#000',
      '#fff',
    ]) {
      const themes = createTheme({ primary: color })
      for (const theme of [themes.light, themes.dark]) {
        const { primary, bg, focus } = theme.color
        expect(contrastRatio(primary.on, primary.DEFAULT)).toBeGreaterThanOrEqual(4.5)
        for (const surface of [bg.canvas, bg.surface, bg.muted, primary.soft]) {
          expect(contrastRatio(primary.text, surface)).toBeGreaterThanOrEqual(4.5)
        }
        expect(primary.soft).toBe(mixColors(primary.DEFAULT, bg.surface, 0.07))
        expect(contrastRatio(focus, bg.canvas)).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('keeps the seed color when it already works', () => {
    const { light: theme } = createTheme({ primary: '#3f56b5' })
    expect(theme.color.primary).toEqual(light.color.primary)
  })

  it('lightens the text tone on dark backgrounds', () => {
    const tone = createTone('#3f56b5', dark)
    expect(tone.DEFAULT).toBe('#3f56b5')
    expect(contrastRatio(tone.text, dark.color.bg.muted)).toBeGreaterThanOrEqual(4.5)
    expect(parseColor(tone.text)[2]).toBeGreaterThan(parseColor(tone.DEFAULT)[2])
  })

  it('leaves tones that were not given untouched', () => {
    const themes = createTheme({ danger: '#e11d48' })
    expect(themes.light.color.primary).toEqual(light.color.primary)
    expect(themes.light.color.focus).toBe(light.color.focus)
    expect(themes.dark.color.success).toEqual(dark.color.success)
    expect(themes.light.color.danger.DEFAULT).toBe('#e11d48')
  })

  it('tints soft tones over the base surface', () => {
    const base = {
      ...light,
      color: { ...light.color, bg: { ...light.color.bg, surface: '#f7f5ef' } },
    }
    const theme = createTheme({ primary: '#7c3aed' }, { light: base }).light
    for (const name of ['neutral', 'primary', 'success', 'warning', 'danger'] as const) {
      const tone = theme.color[name]
      expect(tone.soft).toBe(mixColors(tone.DEFAULT, '#f7f5ef', 0.07))
    }
  })

  it('keeps every tone readable on its tint over the theme editor bases', () => {
    for (const leaning of Object.values(leanings)) {
      for (const theme of [light, dark]) {
        const tinted = (group: Record<string, string>) =>
          Object.fromEntries(
            Object.entries(group).map(([k, v]) => [k, tint(v, leaning.hue, leaning.chroma)]),
          )
        const base = defineTheme(theme, {
          color: {
            bg: tinted(theme.color.bg),
            text: tinted(theme.color.text),
            border: tinted(theme.color.border),
          },
        })
        for (const brand of [{}, { primary: '#7c3aed', warning: '#f59e0b' }]) {
          const { color } = createTheme(brand, { light: base, dark: base })[
            theme === light ? 'light' : 'dark'
          ]
          for (const name of tones) {
            const tone = color[name]
            expect(tone.soft).toBe(mixColors(tone.DEFAULT, color.bg.surface, 0.07))
            for (const ink of [tone.text, color.text.DEFAULT, color.text.secondary]) {
              expect(contrastRatio(ink, tone.soft)).toBeGreaterThanOrEqual(4.5)
            }
          }
        }
      }
    }
  })

  it('moves the text of a tone that was not given only when its tint needs it', () => {
    const base = defineTheme(light, { color: { bg: { surface: '#efe9dc' } } })
    const { success } = createTheme({}, { light: base }).light.color
    expect(success.DEFAULT).toBe(light.color.success.DEFAULT)
    expect(contrastRatio(success.text, success.soft)).toBeGreaterThanOrEqual(4.5)
    expect(createTheme({}).light.color.success).toEqual(light.color.success)
  })

  it('keeps a soft tint that was written by hand', () => {
    const base = defineTheme(light, {
      color: { bg: { surface: '#f7f5ef' }, success: { soft: '#e0f0e0' } },
    })
    const { success, danger } = createTheme({ primary: '#7c3aed' }, { light: base }).light.color
    expect(success.soft).toBe('#e0f0e0')
    expect(danger.soft).toBe(mixColors(danger.DEFAULT, '#f7f5ef', 0.07))
  })

  it('starts from a custom base', () => {
    const base = { ...light, radius: { ...light.radius, control: '999px' } }
    expect(createTheme({ primary: '#7c3aed' }, { light: base }).light.radius.control).toBe('999px')
  })

  it('parses hex and rgb()', () => {
    expect(parseColor('#fff')).toEqual([1, 1, 1])
    expect(parseColor('rgb(255 0 0)')).toEqual([1, 0, 0])
    expect(() => parseColor('red')).toThrow('unsupported color')
  })
})

describe('soft tones', () => {
  it('are the tone mixed 7% into the surface in both built-in themes', () => {
    for (const theme of [light, dark]) {
      for (const name of tones) {
        const tone = theme.color[name]
        expect(tone.soft).toBe(mixColors(tone.DEFAULT, theme.color.bg.surface, 0.07))
      }
    }
  })

  it('keep toned text and body text readable on them', () => {
    for (const theme of [light, dark]) {
      for (const name of tones) {
        const tone = theme.color[name]
        expect(contrastRatio(tone.text, tone.soft)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(theme.color.text.DEFAULT, tone.soft)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(theme.color.text.secondary, tone.soft)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('mixColors', () => {
  it('mixes in OKLab, keeping the ends', () => {
    expect(mixColors('#3f56b5', '#ffffff', 0)).toBe('#ffffff')
    expect(mixColors('#3f56b5', '#ffffff', 1)).toBe('#3f56b5')
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#636363')
  })
})
