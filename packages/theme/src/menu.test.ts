import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/menu.css'), 'utf8').replace(
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

describe('menu.css', () => {
  it('supports vertical padding and first-line actions alignment variables for auto-height rows', () => {
    const item = declarations('.dou-menu__item')
    expect(item).toMatch(
      /padding:\s*var\(--dou-menu-padding-y,\s*0px\)\s+var\(--dou-menu-padding-x\)/,
    )

    const described = declarations('.dou-menu__item.is-described')
    expect(described).toMatch(/padding-block:\s*var\(\s*--dou-menu-padding-y,/)

    const actions = declarations('.dou-menu__actions')
    expect(actions).toMatch(
      /inset-block-start:\s*var\(--dou-menu-actions-top,\s*var\(--dou-menu-padding-y,\s*0px\)\)/,
    )
    expect(actions).toMatch(
      /height:\s*var\(\s*--dou-menu-actions-height,\s*calc\(var\(--dou-menu-item-height\)\s*-\s*2\s*\*\s*var\(--dou-menu-padding-y,\s*0px\)\)\s*\)/,
    )
  })
})
