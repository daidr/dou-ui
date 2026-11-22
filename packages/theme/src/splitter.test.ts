import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/splitter.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

describe('splitter nesting-safe selectors and single-pane styles', () => {
  it('scopes collapsed hiding to direct child start pane only (#483)', () => {
    expect(css).toMatch(
      /\.dou-splitter\.is-collapsed\s*>\s*\.dou-splitter__pane\.is-start\s*\{[^}]*visibility:\s*hidden/,
    )
    expect(css).not.toMatch(/\.dou-splitter\.is-collapsed\s+\.dou-splitter__pane/)
  })

  it('scopes dragging, disabled and orientation rules to direct child bar and handle', () => {
    expect(css).toMatch(/\.dou-splitter\.is-dragging\s*>\s*\.dou-splitter__bar\s*\{/)
    expect(css).not.toMatch(/\.dou-splitter\.is-dragging\s+\.dou-splitter__bar\b/)
    expect(css).toMatch(
      /\.dou-splitter--horizontal\s*>\s*\.dou-splitter__bar\s*>\s*\.dou-splitter__handle\s*\{/,
    )
    expect(css).toMatch(
      /\.dou-splitter--vertical\s*>\s*\.dou-splitter__bar\s*>\s*\.dou-splitter__handle\s*\{/,
    )
    expect(css).toMatch(
      /\.dou-splitter\.is-disabled\s*>\s*\.dou-splitter__bar\s*>\s*\.dou-splitter__handle\s*\{/,
    )
  })

  it('hides only direct divider and inactive pane in single-pane mode (#501)', () => {
    expect(css).toMatch(
      /\.dou-splitter\.is-single-pane\s*>\s*\.dou-splitter__bar,\s*\.dou-splitter\.is-single-start\s*>\s*\.dou-splitter__pane\.is-end,\s*\.dou-splitter\.is-single-end\s*>\s*\.dou-splitter__pane\.is-start\s*\{[^}]*display:\s*none/,
    )
  })
})
