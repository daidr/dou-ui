import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Links on a dark or colored fill: the tooltip and the solid banner.
const here = dirname(fileURLToPath(import.meta.url))
const read = (name: string) =>
  readFileSync(resolve(here, `components/${name}.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations of the rule with exactly this selector, nested rules left out. */
function rule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  const end = css.indexOf('}', start)
  const nested = css.indexOf('{', css.indexOf('{', start) + 1)
  return css.slice(start, nested > 0 && nested < end ? nested : end)
}

describe('links on an inverted fill', () => {
  it.each([
    ['tooltip', '.dou-tooltip .dou-link'],
    ['banner', '.dou-banner--solid :is(.dou-banner__action, .dou-banner__text) .dou-link'],
  ])('take the text color of the %s', (name, selector) => {
    const declarations = rule(read(name), selector)
    expect(declarations).toMatch(/--dou-link-tone:\s*currentColor/)
    // a soft link's fill is made from that color too, never the page's soft gray
    expect(declarations).toMatch(/--dou-link-soft:\s*color-mix\(in oklab, currentColor/)
  })

  it('draw a soft link on a colored solid banner as a plain underlined link', () => {
    const css = read('banner').replace(/\s+/g, ' ')
    const declarations = rule(
      css,
      '.dou-banner--solid:not(.dou-banner--neutral) :is(.dou-banner__action, .dou-banner__text) .dou-link--soft',
    )
    expect(declarations).toMatch(/background-color:\s*transparent/)
    expect(declarations).toMatch(/text-decoration-line:\s*underline/)
  })
})
