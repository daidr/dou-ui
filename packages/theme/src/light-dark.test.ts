import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { transform } from 'lightningcss'
import { describe, expect, it } from 'vitest'

const here = dirname(new URL(import.meta.url).pathname)
const tokens = readFileSync(resolve(here, 'generated/tokens.css'), 'utf8')

const version = (major: number, minor = 0) => (major << 16) | (minor << 8)

/**
 * Browsers without `light-dark()`, the kind a bundler targets by default
 * (Vite lowers it for these). The lowered value only works where the
 * bundler saw a `color-scheme` declaration.
 */
function lower(css: string): string {
  const { code } = transform({
    filename: 'tokens.css',
    code: Buffer.from(`${css}.probe{color:light-dark(red,blue)}`),
    minify: true,
    targets: { chrome: version(111), safari: version(16, 4), firefox: version(114) },
  })
  return code.toString()
}

describe('light-dark() after a bundler lowers it', () => {
  const css = lower(tokens)

  it('is lowered at all, so the checks below mean something', () => {
    expect(css).not.toContain('light-dark(')
  })

  it('resolves to the light value on :root, without data-dou-theme', () => {
    expect(css).toMatch(/(?:^|[{},])\s*:root\s*(?:,[^{]*)?\{[^}]*--lightningcss-light:initial/)
  })

  it('resolves to the light value under data-dou-theme="light"', () => {
    expect(css).toMatch(/\[data-dou-theme=light\][^{]*\{[^}]*--lightningcss-light:initial/)
  })

  it('resolves to the dark value under data-dou-theme="dark"', () => {
    expect(css).toMatch(/\[data-dou-theme=dark\][^{]*\{[^}]*--lightningcss-dark:initial/)
  })
})
