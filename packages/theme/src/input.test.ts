import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (name: string) =>
  readFileSync(resolve(here, `components/${name}.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations of the rule with exactly this selector. */
function rule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

describe('a button in the prefix or suffix', () => {
  it('gets its height from the field', () => {
    expect(read('input')).toMatch(
      /--dou-field-action-size:\s*calc\(\s*var\(--dou-input-height\) - 2px - 2 \* var\(--dou-input-action-inset\)\s*\)/,
    )
    expect(read('input-number')).toMatch(
      /--dou-field-action-size:\s*calc\(\s*var\(--dou-input-number-height\) - 2px - 2 \* var\(--dou-input-number-action-inset\)\s*\)/,
    )
    expect(rule(read('button'), '.dou-button.is-field-action')).toMatch(
      /--dou-button-height:\s*var\(--dou-field-action-size,/,
    )
    expect(rule(read('copy-button'), '.dou-copy-button.is-field-action')).toMatch(
      /--dou-copy-button-size:\s*var\(--dou-field-action-size,/,
    )
  })

  it('takes the place of the padding at the end it sits on', () => {
    const input = read('input')
    expect(rule(input, '.dou-input:has(> .dou-input__suffix.is-edge-action)')).toMatch(
      /padding-inline-end:\s*var\(--dou-input-action-inset\)/,
    )
    expect(rule(input, '.dou-input:has(> .dou-input__prefix.is-edge-action)')).toMatch(
      /padding-inline-start:\s*var\(--dou-input-action-inset\)/,
    )
    const number = read('input-number')
    expect(
      rule(
        number,
        '.dou-input-number:not(.is-controls):has(> .dou-input-number__suffix.is-edge-action)',
      ),
    ).toMatch(/padding-inline-end:\s*var\(--dou-input-number-action-inset\)/)
  })

  it('keeps its focus ring inside the gap', () => {
    expect(read('button')).toMatch(
      /\.dou-button\.is-field-action\s*\{[^}]*&:focus-visible\s*\{\s*outline-offset:\s*0/,
    )
  })
})

describe('the touch area of a button in the prefix or suffix', () => {
  it('stops at the field’s outer edge, above and below as well', () => {
    for (const [name, inset] of [
      ['input', '--dou-input-action-inset'],
      ['input-number', '--dou-input-number-action-inset'],
    ]) {
      expect(read(name!)).toMatch(
        new RegExp(`--dou-field-action-reach:\\s*calc\\(var\\(${inset}\\) \\+ 1px\\)`),
      )
    }
    for (const name of ['button', 'copy-button']) {
      expect(read(name)).toMatch(
        /is-field-action::after\s*\{[^}]*inset:\s*max\(\s*min\(0px, calc\(50% - 20px\)\),\s*calc\(-1 \* var\(--dou-field-action-reach, 0px\)\)\s*\)\s*0/,
      )
    }
    expect(read('input')).toMatch(
      /\.dou-input__suffix\.is-edge-action \.is-field-action:last-child::after\s*\{[^}]*calc\(-1 \* var\(--dou-field-action-reach\)\)/,
    )
  })

  it('grows inwards only right after the text, never over clear, reveal or count', () => {
    const inward = [
      ...read('input').matchAll(/([^{}]*)\.is-field-action:only-child::after\s*\{/g),
    ].map((m) => m[1]!.trim())
    expect(inward).toHaveLength(2)
    expect(inward.find((s) => s.includes('__suffix'))).toMatch(
      /^\.dou-input__native \+ \.dou-input__suffix\.is-edge-action$/,
    )
  })
})
