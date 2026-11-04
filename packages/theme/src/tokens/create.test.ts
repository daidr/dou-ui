import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  createTheme,
  createTone,
  dark,
  light,
  mixColors,
  parseColor,
} from '../index'

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
  const tones = ['neutral', 'primary', 'success', 'warning', 'danger'] as const

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
