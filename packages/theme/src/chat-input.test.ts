import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/chat-input.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the rule with exactly this selector. */
function rule(selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

describe('chat input menu options', () => {
  it('cut a long label short instead of letting it run out of the menu', () => {
    const label = rule('.dou-chat-input__option-label')
    expect(label).toMatch(/flex:\s*0 1 auto/)
    expect(label).toMatch(/min-width:\s*0/)
    expect(label).toMatch(/text-overflow:\s*ellipsis/)
    expect(label).toMatch(/white-space:\s*nowrap/)
  })

  it('keep a short description whole and a long one to half the row', () => {
    const description = rule('.dou-chat-input__option-description')
    expect(description).toMatch(/flex:\s*none/)
    expect(description).toMatch(/max-width:\s*50%/)
    expect(description).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('never scroll the menu sideways', () => {
    expect(rule('.dou-chat-input__menu')).toMatch(/overflow-x:\s*hidden/)
  })
})
