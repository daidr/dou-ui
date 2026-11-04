import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/link.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the first `.dou-link {` rule, nested rules left out. */
function baseRule(): string {
  const start = css.indexOf('.dou-link {')
  let depth = 0
  let body = ''
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) break
    else if (depth === 1) body += css[i]
  }
  return body
}

describe('link.css', () => {
  // Without an href DouLink is a <button>, whose browser styles reset these
  // text settings; the <a> form inherits them, so both forms must look alike.
  it.each([
    'font',
    'letter-spacing',
    'word-spacing',
    'text-transform',
    'text-shadow',
    'text-rendering',
    'text-align',
  ])('makes the button form inherit %s', (property) => {
    expect(baseRule()).toMatch(new RegExp(`(^|[;\\s])${property}:\\s*inherit;`))
  })

  it('drops the button chrome', () => {
    const rule = baseRule()
    for (const declaration of ['appearance: none', 'padding: 0', 'border: 0', 'background: none'])
      expect(rule).toContain(declaration)
  })
})
