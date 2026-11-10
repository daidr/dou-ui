import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/input.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the rule with exactly this selector. */
function rule(selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

describe('a button in the prefix or suffix', () => {
  it('takes its height and corners from the field', () => {
    const button = rule('.dou-input__affix > .dou-button')
    expect(button).toMatch(
      /--dou-button-height:\s*calc\(var\(--dou-input-height\) - 2px - 2 \* var\(--dou-input-action-inset\)\)/,
    )
    expect(button).toMatch(/--dou-button-radius:/)
  })

  it('takes the place of the padding at the end it sits on', () => {
    expect(rule('.dou-input:has(> .dou-input__suffix > .dou-button:last-child)')).toMatch(
      /padding-inline-end:\s*var\(--dou-input-action-inset\)/,
    )
    expect(rule('.dou-input:has(> .dou-input__prefix > .dou-button:first-child)')).toMatch(
      /padding-inline-start:\s*var\(--dou-input-action-inset\)/,
    )
  })
})
