import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/button.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the first rule whose selector is `selector`. */
function declarations(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const start = css.search(new RegExp(`^\\s*${escaped}\\s*\\{`, 'm'))
  expect(start).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  return ''
}

describe('button.css', () => {
  it('lets .dou-button__label shrink and truncate inside width-constrained buttons', () => {
    const label = declarations('.dou-button__label')
    expect(label).toMatch(/min-width:\s*0/)
    expect(label).toMatch(/overflow-x:\s*clip/)
    expect(label).toMatch(/text-overflow:\s*ellipsis/)
    expect(label).toMatch(/text-box:\s*trim-both cap alphabetic/)
  })
})
