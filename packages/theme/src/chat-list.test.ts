import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (name: string) =>
  readFileSync(resolve(here, `components/${name}.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations of the last rule with exactly this selector. */
function rule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = [...css.matchAll(new RegExp(`^[ \\t]*${escaped} \\{`, 'gm'))]
  const last = matches.at(-1)
  if (!last || last.index === undefined) throw new Error(`no rule for ${selector}`)
  return css.slice(last.index, css.indexOf('}', last.index))
}

describe('chat message actions in a chat list', () => {
  it('stick to the top while a long message scrolls by', () => {
    const toolbar = rule(read('chat-message'), '.dou-chat-message__toolbar')
    expect(toolbar).toMatch(/position:\s*sticky/)
  })

  it('keeps toolbar sticky with `items` since virtual list items stay in normal flow', () => {
    expect(read('chat-list')).not.toMatch(
      /\.dou-chat-list\.is-virtual\s+\.dou-chat-message__toolbar/,
    )
  })

  it('leave room above the first message for its actions', () => {
    const list = rule(read('chat-list'), '.dou-chat-list')
    expect(list).toMatch(
      /--dou-chat-list-padding-top:\s*calc\(var\(--dou-chat-list-padding\) \+ 12px\)/,
    )
    const content = rule(read('chat-list'), '.dou-chat-list__content')
    expect(content).toMatch(/padding-top:\s*var\(--dou-chat-list-padding-top\)/)
  })

  it('links bottom inset across viewport, content, virtual spacer, scroll button and fade mask', () => {
    const css = read('chat-list')
    const list = rule(css, '.dou-chat-list')
    expect(list).toMatch(/--dou-chat-list-bottom-inset:\s*0px/)
    expect(list).toMatch(/--dou-chat-list-bottom-fade:\s*32px/)
    expect(list).toMatch(/--dou-chat-list-scroll-offset:\s*12px/)

    const viewport = rule(css, '.dou-chat-list__viewport')
    expect(viewport).toMatch(/scroll-padding-block-end:\s*var\(--dou-chat-list-bottom-inset\)/)

    const content = rule(css, '.dou-chat-list__content')
    expect(content).toMatch(
      /padding-bottom:\s*calc\(var\(--dou-chat-list-padding\) \+ var\(--dou-chat-list-bottom-inset\)\)/,
    )

    const spacer = rule(css, '.dou-chat-list.is-virtual .dou-virtual-list__spacer')
    expect(spacer).toMatch(
      /padding-bottom:\s*calc\(var\(--dou-chat-list-padding\) \+ var\(--dou-chat-list-bottom-inset\)\)/,
    )

    const scroll = rule(css, '.dou-chat-list__scroll')
    expect(scroll).toMatch(
      /inset-block-end:\s*calc\(var\(--dou-chat-list-scroll-offset\) \+ var\(--dou-chat-list-bottom-inset\)\)/,
    )

    const fade = rule(css, '.dou-chat-list.is-bottom-fade .dou-chat-list__viewport')
    expect(fade).toMatch(/mask-image:\s*linear-gradient\(/)
  })

  it('restores top padding on a headless chat plan list', () => {
    const planCss = read('chat-plan')
    const headless = rule(planCss, '.dou-chat-plan.is-headless &')
    expect(headless).toMatch(/padding-top:\s*10px/)
  })
})
