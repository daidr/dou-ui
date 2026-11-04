import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'components/dropdown.css'),
  'utf8',
)

/** The declarations of the first rule whose selector is exactly `selector`. */
function declarations(selector: string): string {
  const start = css.search(new RegExp(`^\\s*${selector.replace(/[.-]/g, '\\$&')}\\s*\\{`, 'm'))
  expect(start).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  return ''
}

describe('dropdown.css', () => {
  it('keeps a menu inside the screen, so a long label ends in an ellipsis', () => {
    expect(declarations('.dou-dropdown')).toMatch(/max-width:\s*calc\(100vw - 16px\)/)
    const label = declarations('.dou-dropdown__label')
    expect(label).toMatch(/min-width:\s*0/)
    expect(label).toMatch(/text-overflow:\s*ellipsis/)
  })
})
