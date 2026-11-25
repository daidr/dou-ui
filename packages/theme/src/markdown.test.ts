import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/markdown.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the first rule with exactly this selector. */
function rule(selector: string) {
  const start = css.indexOf(`${selector} {`)
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

describe('markdown table styles', () => {
  it('lets wide tables expand inside a contained horizontal scroller while keeping narrow tables full width', () => {
    const wrapper = rule('.dou-markdown__table')
    expect(wrapper).toMatch(/display:\s*flex/)
    expect(wrapper).toMatch(/max-width:\s*100%/)
    expect(wrapper).toMatch(/overflow-x:\s*auto/)
    expect(wrapper).toMatch(/overscroll-behavior-x:\s*contain/)
    expect(wrapper).toMatch(/& > table\s*\{[^}]*flex:\s*none/)
    expect(wrapper).toMatch(/& > table\s*\{[^}]*min-width:\s*100%/)
  })

  it('constrains cell column widths via inheritable CSS variables and wraps long tokens safely', () => {
    const root = rule('.dou-markdown')
    // do not reset on .dou-markdown so outer containers such as DouChatList / DouChatMessage can set them
    expect(root).not.toMatch(/--dou-markdown-table-col-min-width\s*:/)
    expect(root).not.toMatch(/--dou-markdown-table-col-max-width\s*:/)
    expect(root).not.toMatch(/--dou-markdown-table-scroll-fade\s*:/)

    const wrapper = rule('.dou-markdown__table')
    expect(wrapper).toMatch(/box-sizing:\s*border-box/)
    expect(wrapper).toMatch(/min-inline-size:\s*var\(--dou-markdown-table-col-min-width,\s*96px\)/)
    expect(wrapper).toMatch(
      /max-inline-size:\s*var\(--dou-markdown-table-col-max-width,\s*min\(320px,\s*70vw\)\)/,
    )
    expect(wrapper).toMatch(/overflow-wrap:\s*anywhere/)
    expect(wrapper).not.toMatch(/white-space:\s*nowrap/)
  })

  it('fades clipped horizontal edges via mask-image toggled by is-cut-start and is-cut-end', () => {
    const wrapper = rule('.dou-markdown__table')
    expect(wrapper).not.toMatch(/&::before|&::after/)
    expect(wrapper).toMatch(/&\.is-cut-start\s*\{[^}]*mask-image:\s*linear-gradient\(/)
    expect(wrapper).toMatch(/&\.is-cut-end\s*\{[^}]*mask-image:\s*linear-gradient\(/)
    expect(wrapper).toMatch(/&\.is-cut-start\.is-cut-end\s*\{[^}]*mask-image:\s*linear-gradient\(/)
    expect(wrapper).toMatch(/var\(--dou-markdown-table-scroll-fade,\s*24px\)/)
  })
})
