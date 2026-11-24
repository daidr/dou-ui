import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/chat-input.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the last rule with exactly this selector. */
function rule(selector: string) {
  const start = css.lastIndexOf(`${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  let depth = 0
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(start, i + 1)
    }
  }
  return css.slice(start)
}

describe('chat input menu options', () => {
  it('exposes a configurable menu max width with a 440px desktop default and no horizontal scroll', () => {
    const menu = rule('.dou-chat-input__menu')
    expect(menu).toMatch(/--dou-chat-input-menu-max-width,\s*440px/)
    expect(menu).toMatch(/--dou-chat-input-menu-width/)
    expect(menu).toMatch(/calc\(100vw - 16px\)/)
    expect(menu).toMatch(/overflow-x:\s*hidden/)
  })

  it('uses a single-line aligned flex layout for default mention options', () => {
    const option = rule('.dou-chat-input__option')
    expect(option).toMatch(/display:\s*flex/)
    expect(option).toMatch(/align-items:\s*center/)

    const icon = rule('.dou-chat-input__option-icon')
    expect(icon).toMatch(/flex:\s*none/)
    expect(icon).toMatch(/width:\s*16px/)

    const defaultRule = rule('&.is-default')
    expect(defaultRule).toMatch(/& > \.dou-chat-input__option-label\s*\{[^}]*flex:\s*1 1 auto/)
    expect(defaultRule).toMatch(/& > \.dou-chat-input__option-description\s*\{[^}]*flex:\s*none/)
    expect(defaultRule).toMatch(
      /& > \.dou-chat-input__option-description\s*\{[^}]*max-width:\s*45%/,
    )
    expect(defaultRule).toMatch(
      /& > \.dou-chat-input__option-description\s*\{[^}]*text-align:\s*end/,
    )
  })

  it('stacks label and full-width description on two lines for `/` commands with descriptions', () => {
    const stacked = rule('&.is-stacked')
    expect(stacked).toMatch(/align-items:\s*flex-start/)

    const content = rule('.dou-chat-input__option-content')
    expect(content).toMatch(/display:\s*flex/)
    expect(content).toMatch(/flex:\s*1 1 auto/)
    expect(content).toMatch(/flex-direction:\s*column/)
    expect(content).toMatch(/min-width:\s*0/)
  })

  it('truncates both label and description to a single line', () => {
    const label = rule('.dou-chat-input__option-label')
    expect(label).toMatch(/overflow:\s*hidden/)
    expect(label).toMatch(/text-overflow:\s*ellipsis/)
    expect(label).toMatch(/white-space:\s*nowrap/)
    expect(label).not.toMatch(/line-clamp/)

    const description = rule('.dou-chat-input__option-description')
    expect(description).toMatch(/overflow:\s*hidden/)
    expect(description).toMatch(/text-overflow:\s*ellipsis/)
    expect(description).toMatch(/white-space:\s*nowrap/)
    expect(description).toMatch(/font-size:\s*12px/)
  })

  it('does not impose a 40% max-width cap on descriptions inside custom `#option` slots', () => {
    expect(css).not.toMatch(/&:not\(\.is-default\)[\s\S]*max-width:\s*40%/)
    expect(css).toMatch(
      /&:not\(\.is-default\)\s*>\s*\.dou-chat-input__option-label\s*\{[^}]*flex:\s*1 1 auto/,
    )
  })
})
