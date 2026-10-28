import { describe, expect, it } from 'vitest'
import { cssVarName, defineTheme, flattenTokens, light, themeToCss } from '../index'

describe('cssVarName', () => {
  it('joins paths, kebab-cases keys and drops DEFAULT', () => {
    expect(cssVarName('color.primary.DEFAULT')).toBe('--dou-color-primary')
    expect(cssVarName('color.primary.on')).toBe('--dou-color-primary-on')
    expect(cssVarName('control.paddingX.md')).toBe('--dou-control-padding-x-md')
  })
})

describe('flattenTokens', () => {
  it('produces a unique variable for every leaf token', () => {
    const names = flattenTokens(light).map(([name]) => name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('--dou-color-bg-canvas')
    expect(names).toContain('--dou-font-line-height')
  })
})

describe('defineTheme', () => {
  it('deep-merges overrides without mutating the base', () => {
    const brand = defineTheme(light, { color: { primary: { DEFAULT: '#7c3aed' } } })
    expect(brand.color.primary.DEFAULT).toBe('#7c3aed')
    expect(brand.color.primary.on).toBe(light.color.primary.on)
    expect(light.color.primary.DEFAULT).not.toBe('#7c3aed')
  })
})

describe('themeToCss', () => {
  it('scopes a theme to a selector', () => {
    const css = themeToCss(light, '.sidebar')
    expect(css.startsWith('.sidebar {')).toBe(true)
    expect(css).toContain(`--dou-color-primary: ${light.color.primary.DEFAULT};`)
  })
})
