import { globSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTheme, dark, flattenTokens, light } from './index'

const here = dirname(new URL(import.meta.url).pathname)
const packages = resolve(here, '../..')

const schemeDark = (tokens: typeof light) => new Map(flattenTokens(tokens)).get('--dou-scheme-dark')

describe('--dou-scheme-dark', () => {
  it('is 0 in light themes and 1 in dark ones', () => {
    expect(schemeDark(light)).toBe('0')
    expect(schemeDark(dark)).toBe('1')
    const brand = createTheme({ primary: '#7c3aed' })
    expect(schemeDark(brand.light)).toBe('0')
    expect(schemeDark(brand.dark)).toBe('1')
  })

  // Bundlers lower `light-dark()` into custom properties that only switch on
  // where `color-scheme` is declared, so the default light theme on `:root`
  // lost those values. Styles mix with `--dou-scheme-dark` instead.
  it('is used instead of light-dark() in every stylesheet', () => {
    const offenders = globSync('*/src/**/*.{css,vue}', { cwd: packages })
      .filter((file) => !file.includes('/generated/'))
      .filter((file) => {
        const code = readFileSync(resolve(packages, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
        return /light-dark\(/.test(code)
      })
      .map((file) => relative(packages, resolve(packages, file)))
    expect(offenders).toEqual([])
  })
})
