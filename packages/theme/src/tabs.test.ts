import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/tabs.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

describe('tabs list height and marker stacking styles', () => {
  it('uses border-box min-height including vertical padding so host border-box resets do not clip the marker', () => {
    const match = css.match(/^\s*\.dou-tabs__list\s*\{[^}]+\}/m)
    expect(match).not.toBeNull()
    expect(match![0]).toMatch(/box-sizing:\s*border-box/)
    expect(match![0]).toMatch(/min-height:\s*calc\(var\(--dou-tabs-height\)\s*\+\s*10px\)/)
    expect(match![0]).toMatch(/padding:\s*4px 0 6px/)
  })

  it('resets list min-height in vertical mode', () => {
    expect(css).toMatch(
      /\.dou-tabs\.is-vertical\s*\{[\s\S]*?&\s*\.dou-tabs__list\s*\{[^}]*min-height:\s*0/,
    )
  })

  it('paints the drop marker above sibling tab containers', () => {
    const tablist = css.match(/^\s*\.dou-tabs__tablist\s*\{[^}]+\}/m)
    const marker = css.match(/^\s*\.dou-tabs__marker\s*\{[^}]+\}/m)
    expect(tablist?.[0]).toMatch(/isolation:\s*isolate/)
    expect(marker?.[0]).toMatch(/z-index:\s*1/)
  })

  it('does not let tab :hover override .is-merge-target highlight', () => {
    expect(css).toMatch(/&:hover:not\(\.is-disabled\):not\(\.is-merge-target\)/)
    expect(css).toMatch(
      /\.dou-tabs-dragging\s+\.dou-tabs__tab:hover:not\(\.is-disabled\):not\(\.is-merge-target\)/,
    )
  })
})
