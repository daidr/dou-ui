import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (name: string) =>
  readFileSync(resolve(here, `components/${name}.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations of the rule whose selector ends with this text. */
function rule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

describe('links on an inverted fill', () => {
  it.each([
    ['tooltip', '.dou-tooltip .dou-link'],
    ['banner', '.dou-banner--solid .dou-banner__text .dou-link'],
  ])('take the text color of the %s', (name, selector) => {
    const declarations = rule(read(name), selector)
    expect(declarations).toMatch(/--dou-link-tone:\s*currentColor/)
    // a soft link's fill is made from that color too, never the page's soft gray
    expect(declarations).toMatch(/--dou-link-soft:\s*color-mix\(in oklab, currentColor/)
  })
})
