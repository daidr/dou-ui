import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/virtual-list.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the last rule with exactly this selector. */
function rule(selector: string) {
  const start = css.lastIndexOf(`${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

describe('virtual list layout for native sticky children', () => {
  it('disables browser scroll anchoring on the scroll container', () => {
    const list = rule('.dou-virtual-list')
    expect(list).toMatch(/overflow-anchor:\s*none/)
  })

  it('keeps items in normal document flow without absolute positioning', () => {
    const item = rule('.dou-virtual-list__item')
    expect(item).not.toMatch(/position:\s*absolute/)
    expect(item).not.toMatch(/transform\s*:/)
    expect(item).toMatch(/display:\s*flow-root/)
  })

  it('keeps the spacer free of overflow clipping and transforms', () => {
    const spacer = rule('.dou-virtual-list__spacer')
    expect(spacer).not.toMatch(/overflow\s*:/)
    expect(spacer).not.toMatch(/transform\s*:/)
  })
})
