import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/segmented-control.css'), 'utf8').replace(
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

/** Direct declarations of a rule body, with nested rule blocks stripped. */
function directDeclarations(body: string): string {
  let out = ''
  let depth = 0
  let start = 0
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '{') {
      if (depth === 0) out += body.slice(start, i)
      depth++
    } else if (body[i] === '}') {
      depth--
      if (depth === 0) start = i + 1
    }
  }
  if (depth === 0) out += body.slice(start)
  return out
}

describe('segmented-control.css', () => {
  it('allows the track and non-block items to shrink inside narrow containers', () => {
    const root = directDeclarations(block(css, '.dou-segmented-control'))
    expect(root).toMatch(/min-width:\s*0/)
    expect(root).toMatch(/max-width:\s*100%/)

    const item = directDeclarations(block(css, '.dou-segmented-control__item'))
    expect(item).toMatch(/min-width:\s*0/)
    expect(item).toMatch(/white-space:\s*nowrap/)
  })

  it('keeps bare .dou-segmented-control__label block-level for ellipsis and switches to inline-flex only for custom children', () => {
    const label = block(css, '.dou-segmented-control__label')
    const base = directDeclarations(label)
    expect(base).not.toMatch(/display:\s*(?:inline-)?flex/)
    expect(base).toMatch(/min-width:\s*0/)
    expect(base).toMatch(/overflow-x:\s*clip/)
    expect(base).toMatch(/text-overflow:\s*ellipsis/)
    expect(base).toMatch(/text-box:\s*trim-both cap alphabetic/)

    const custom = block(label, '&:has(> *)')
    expect(custom).toMatch(/display:\s*inline-flex/)
    expect(custom).toMatch(/align-items:\s*center/)
    expect(custom).toMatch(/gap:\s*var\(--dou-control-gap-md\)/)
    expect(block(custom, '& > svg')).toMatch(/flex-shrink:\s*0/)
  })

  it('truncates wrapped text segments in mixed custom #option slots', () => {
    const text = directDeclarations(block(css, '.dou-segmented-control__text'))
    expect(text).toMatch(/min-width:\s*0/)
    expect(text).toMatch(/overflow-x:\s*clip/)
    expect(text).toMatch(/text-overflow:\s*ellipsis/)
    expect(text).toMatch(/text-box:\s*trim-both cap alphabetic/)
  })
})
