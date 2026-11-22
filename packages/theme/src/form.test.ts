import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/form.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the first rule whose selector is `selector`. */
function declarations(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const start = css.search(new RegExp(`^\\s*${escaped}\\s*\\{`, 'm'))
  expect(start).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  return ''
}

describe('form.css', () => {
  it('aligns required/optional marks to the first line baseline and wraps long unbroken labels', () => {
    const label = declarations('.dou-form-item__label')
    expect(label).toMatch(/align-items:\s*baseline/)
    expect(label).toMatch(/overflow-wrap:\s*anywhere/)
    expect(declarations('.dou-form-item__asterisk')).toMatch(/flex-shrink:\s*0/)
    expect(declarations('.dou-form-item__optional')).toMatch(/flex-shrink:\s*0/)
  })

  it('keeps horizontal and inline labels centered on the first line beside the control', () => {
    const start = css.indexOf('.dou-form--horizontal,')
    expect(start).toBeGreaterThanOrEqual(0)
    const block = css.slice(start, css.indexOf('\n  .dou-form--horizontal >', start))
    expect(block).toMatch(/box-sizing:\s*border-box/)
    expect(block).toMatch(
      /padding-block-start:\s*calc\(\(var\(--dou-form-item-control-height\) - 1cap\) \/ 2\)/,
    )
    expect(declarations('.dou-form--horizontal.is-fixed-label .dou-form-item__label')).toMatch(
      /white-space:\s*normal/,
    )
  })
})
