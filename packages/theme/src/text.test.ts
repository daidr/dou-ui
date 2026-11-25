import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/text.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The inner body of the first rule whose selector matches `selector` inside `source`. */
function block(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const start = source.search(new RegExp(`^\\s*${escaped}\\s*\\{`, 'm'))
  expect(start).toBeGreaterThanOrEqual(0)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i)
  }
  return ''
}

describe('text.css', () => {
  it('lets .dou-text.is-truncate shrink in flex/grid containers while clipping horizontally only', () => {
    const text = block(css, '.dou-text')
    const truncate = block(text, '&.is-truncate')

    expect(truncate).toMatch(/display:\s*inline-block/)
    expect(truncate).toMatch(/min-width:\s*0/)
    expect(truncate).toMatch(/max-width:\s*100%/)
    expect(truncate).toMatch(/overflow-x:\s*clip/)
    expect(truncate).not.toMatch(/(^|[;\s])overflow:\s*hidden/)
    expect(truncate).toMatch(/text-overflow:\s*ellipsis/)
    expect(truncate).toMatch(/white-space:\s*nowrap/)
    expect(truncate).toMatch(/vertical-align:\s*bottom/)
  })

  it('keeps .dou-text.is-clamp using multi-line clamping', () => {
    const text = block(css, '.dou-text')
    const clamp = block(text, '&.is-clamp')

    expect(clamp).toMatch(/display:\s*-webkit-box/)
    expect(clamp).toMatch(/overflow:\s*hidden/)
    expect(clamp).toMatch(/-webkit-line-clamp:\s*var\(--dou-text-lines\)/)
    expect(clamp).toMatch(/line-clamp:\s*var\(--dou-text-lines\)/)
  })
})
