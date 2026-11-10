import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (name: string) =>
  readFileSync(resolve(here, `components/${name}.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations of the last rule with exactly this selector. */
function rule(css: string, selector: string) {
  const start = css.lastIndexOf(`${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

describe('chat message actions in a chat list', () => {
  it('stick to the top while a long message scrolls by', () => {
    const toolbar = rule(read('chat-message'), '.dou-chat-message__toolbar')
    expect(toolbar).toMatch(/position:\s*sticky/)
  })

  it('stay put with `items`, whose messages are placed with a transform', () => {
    const virtual = rule(read('chat-list'), '.dou-chat-list.is-virtual .dou-chat-message__toolbar')
    expect(virtual).toMatch(/position:\s*relative/)
    expect(virtual).toMatch(/top:\s*auto/)
  })

  it('leave room above the first message for its actions', () => {
    const list = rule(read('chat-list'), '.dou-chat-list')
    expect(list).toMatch(
      /--dou-chat-list-padding-top:\s*calc\(var\(--dou-chat-list-padding\) \+ 12px\)/,
    )
    const content = rule(read('chat-list'), '.dou-chat-list__content')
    expect(content).toMatch(/padding-top:\s*var\(--dou-chat-list-padding-top\)/)
  })
})
