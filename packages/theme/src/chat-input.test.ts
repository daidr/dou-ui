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
  it('share the row evenly, each part taking what it needs while there is room', () => {
    const custom = rule('.dou-chat-input__option')
    expect(custom).toMatch(/display:\s*flex/)
    expect(custom).toMatch(/align-items:\s*center/)
    const option = rule('&.is-default')
    expect(option).toMatch(/display:\s*grid/)
    expect(option).toMatch(/grid-auto-flow:\s*column/)
    expect(option).toMatch(/grid-auto-columns:\s*minmax\(0, max-content\)/)
  })

  it('wrap a long label onto two lines before cutting it short', () => {
    const label = rule('.dou-chat-input__option-label')
    expect(label).toMatch(/-webkit-line-clamp:\s*2/)
    expect(label).toMatch(/overflow:\s*hidden/)
    expect(label).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('keep a description to one line', () => {
    const description = rule('.dou-chat-input__option-description')
    expect(description).toMatch(/text-overflow:\s*ellipsis/)
    expect(description).toMatch(/white-space:\s*nowrap/)
  })

  it('never scroll the menu sideways', () => {
    expect(rule('.dou-chat-input__menu')).toMatch(/overflow-x:\s*hidden/)
  })
})
