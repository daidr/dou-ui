import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/command.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

function rule(selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  let depth = 0
  for (let at = css.indexOf('{', start); at < css.length; at++) {
    if (css[at] === '{') depth++
    else if (css[at] === '}' && --depth === 0) return css.slice(start, at)
  }
  throw new Error(`unclosed rule for ${selector}`)
}

describe('command rows', () => {
  it('grow with an item slot taller than one line', () => {
    const item = rule('.dou-command__item')
    expect(item).toMatch(/min-height:\s*36px/)
    expect(item).not.toMatch(/(^|[\s;{])height:/)
    // slot content keeps the inherited line height and wraps as it likes
    expect(item).not.toMatch(/line-height|white-space/)
  })

  it('keeps the default label and description on one line', () => {
    for (const selector of ['.dou-command__label', '.dou-command__description']) {
      expect(rule(selector)).toMatch(/white-space:\s*nowrap/)
    }
  })
})
