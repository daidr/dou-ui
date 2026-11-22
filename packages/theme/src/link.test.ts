import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/link.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the first `.dou-link {` rule, nested rules left out. */
function baseRule(): string {
  const start = css.indexOf('.dou-link {')
  let depth = 0
  let body = ''
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) break
    else if (depth === 1) body += css[i]
  }
  return body
}

describe('link.css', () => {
  // Without an href DouLink is a <button>, whose browser styles reset these
  // text settings; the <a> form inherits them, so both forms must look alike.
  it.each([
    'font',
    'letter-spacing',
    'word-spacing',
    'text-transform',
    'text-shadow',
    'text-rendering',
    'text-align',
  ])('makes the button form inherit %s', (property) => {
    expect(baseRule()).toMatch(new RegExp(`(^|[;\\s])${property}:\\s*inherit;`))
  })

  it('drops the button chrome', () => {
    const rule = baseRule()
    for (const declaration of ['appearance: none', 'padding: 0', 'border: 0', 'background: none'])
      expect(rule).toContain(declaration)
  })

  // Underlines propagate from `.dou-link` itself. Re-declaring them on
  // `.dou-link__label` stacks a second translucent line over the middle
  // characters of a soft link while leaving `.dou-link__lead` / `trail` lighter.
  it('does not paint a second underline on .dou-link__label', () => {
    expect(css).not.toMatch(/\.dou-link__label\s*\{[^}]*text-decoration-line\s*:/)
  })
})

describe('links inside DouMarkdown', () => {
  const markdownCss = readFileSync(resolve(here, 'components/markdown.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  )

  it('styles plain Markdown anchors without overriding DouUI link components', () => {
    expect(markdownCss).toMatch(
      /& :where\(a:not\(\[class\*='dou-'\]\), \.dou-markdown__link\)\s*\{[^}]*text-decoration-line:\s*underline/,
    )
    expect(markdownCss).toMatch(/& :where\(a:not\(\[class\*='dou-'\]\):hover\)\s*\{/)
    expect(markdownCss).toMatch(/& :where\(a:not\(\[class\*='dou-'\]\):focus-visible\)\s*\{/)

    // Verify selector matching directly against DOM nodes
    const root = document.createElement('div')
    root.className = 'dou-markdown'
    root.innerHTML = [
      '<a id="plain" href="/docs">文档</a>',
      '<span id="pending" class="dou-markdown__link">流式</span>',
      '<a id="soft" class="dou-link dou-link--neutral dou-link--soft dou-link--underline-none" href="/pr">PR #463</a>',
      '<a id="text" class="dou-link dou-link--primary dou-link--text dou-link--underline-always" href="/pr">PR #463</a>',
      '<a id="citation" class="dou-chat-citation" href="/src">1</a>',
    ].join('')

    const selector = ".dou-markdown :where(a:not([class*='dou-']), .dou-markdown__link)"
    expect(root.querySelector('#plain')!.matches(selector)).toBe(true)
    expect(root.querySelector('#pending')!.matches(selector)).toBe(true)
    expect(root.querySelector('#soft')!.matches(selector)).toBe(false)
    expect(root.querySelector('#text')!.matches(selector)).toBe(false)
    expect(root.querySelector('#citation')!.matches(selector)).toBe(false)
  })
})

describe('icons of a soft link', () => {
  it('sets display: inline for both soft and wrap links so they break across lines', () => {
    const start = css.indexOf(':is(.dou-link--soft, .dou-link.is-wrap) {')
    expect(start).toBeGreaterThan(-1)
    const block = css.slice(start, css.indexOf('& > .dou-link__lead', start))
    expect(block).toMatch(/display:\s*inline/)
  })

  // a flex container takes its baseline from its first item; an empty item
  // one em tall makes that the bottom of the icon box, whatever the content
  it('sit on the text by the bottom of a one-em box, not by their content', () => {
    const at = css.indexOf('& .dou-link__icon {', css.indexOf('.dou-link--soft {'))
    const block = css.slice(at, css.indexOf('}\n    }', at) + 1)
    expect(block).toMatch(/height:\s*1em/)
    expect(block).toMatch(/align-items:\s*center/)
    // a wrapper element around an icon must not stand a line tall
    expect(block).toMatch(/line-height:\s*0/)
    expect(block).toMatch(/vertical-align:\s*-0\.125em/)
    expect(block).toMatch(/&::before\s*\{[^}]*height:\s*1em[^}]*content:\s*''/)
  })

  it('keep text in place of an icon on the label’s baseline', () => {
    const at = css.indexOf('& .dou-link__icon:not(:has(> *)) {')
    expect(at).toBeGreaterThan(-1)
    const block = css.slice(at, css.indexOf('}\n    }', at) + 1)
    expect(block).toMatch(/vertical-align:\s*baseline/)
    expect(block).toMatch(/line-height:\s*inherit/)
    expect(block).toMatch(/&::before\s*\{\s*content:\s*none/)
  })
})
