import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'components/dropdown.css'),
  'utf8',
)

/** The declarations of the first rule whose selector is exactly `selector`. */
function declarations(selector: string): string {
  const start = css.search(new RegExp(`^\\s*${selector.replace(/[.-]/g, '\\$&')}\\s*\\{`, 'm'))
  expect(start).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  return ''
}

describe('dropdown.css', () => {
  it('keeps a menu inside the screen, so a long label ends in an ellipsis', () => {
    expect(declarations('.dou-dropdown')).toMatch(/max-width:\s*calc\(100vw - 16px\)/)
    const label = declarations('.dou-dropdown__label')
    expect(label).toMatch(/min-width:\s*0/)
    expect(label).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('hides orphaned and duplicate separators automatically', () => {
    const separator = declarations('.dou-dropdown__separator')
    expect(separator).toMatch(/&:first-child/)
    expect(separator).toMatch(/&:last-child/)
    expect(separator).toMatch(/&\s*\+\s*\.dou-dropdown__separator/)
    expect(separator).toMatch(/&:not\(:has\(~\s*:not\(\.dou-dropdown__separator\)\)\)/)
    expect(separator).toMatch(/\.dou-dropdown__group-label\s*\+\s*&/)
    expect(separator).toMatch(/display:\s*none/)

    // Verify standard selectors directly against DOM trees
    // (happy-dom's SelectorParser does not support relative `:has(~ ...)`, which is verified above in CSS)
    const hidden = [
      '.dou-dropdown__separator:first-child',
      '.dou-dropdown__separator:last-child',
      '.dou-dropdown__separator + .dou-dropdown__separator',
      '.dou-dropdown__group-label + .dou-dropdown__separator',
    ].join(', ')

    const menu = document.createElement('div')
    menu.className = 'dou-dropdown'
    menu.innerHTML = [
      '<!-- empty leading slot -->',
      '<div id="leading" role="separator" class="dou-dropdown__separator"></div>',
      '<div class="dou-dropdown__item">编辑</div>',
      '<div id="valid" role="separator" class="dou-dropdown__separator"></div>',
      '<div id="dup" role="separator" class="dou-dropdown__separator"></div>',
      '<div class="dou-dropdown__item">删除</div>',
      '<div id="trailing" role="separator" class="dou-dropdown__separator"></div>',
    ].join('')

    expect(menu.querySelector('#leading')!.matches(hidden)).toBe(true)
    expect(menu.querySelector('#valid')!.matches(hidden)).toBe(false)
    expect(menu.querySelector('#dup')!.matches(hidden)).toBe(true)
    expect(menu.querySelector('#trailing')!.matches(hidden)).toBe(true)

    const group = document.createElement('div')
    group.className = 'dou-dropdown__group'
    group.innerHTML = [
      '<div class="dou-dropdown__group-label">分组</div>',
      '<div id="under-label" role="separator" class="dou-dropdown__separator"></div>',
      '<div class="dou-dropdown__item">项</div>',
    ].join('')
    expect(group.querySelector('#under-label')!.matches(hidden)).toBe(true)
  })
})
