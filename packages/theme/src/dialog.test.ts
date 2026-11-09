import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (name: string) =>
  readFileSync(resolve(here, `components/${name}`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const css = read('dialog.css')

/** The declarations of the top-level rule with exactly this selector. */
function rule(source: string, selector: string): string {
  const start = source.indexOf(`  ${selector} {`)
  if (start < 0) throw new Error(`no rule for ${selector}`)
  let depth = 0
  let body = ''
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) break
    else if (depth === 1) body += source[i]
  }
  return body.trim()
}

describe('dialog.css', () => {
  // Without a header row the body keeps the same padding on every side, so
  // `--dou-dialog-padding: 0` takes it to the edge (#397).
  it('pads the body with --dou-dialog-padding alone', () => {
    expect(rule(css, '.dou-dialog__body')).toMatch(/(^|;\s*)padding: var\(--dou-dialog-padding\);/)
  })

  it('keeps the 8px gap for under a header row only', () => {
    expect(rule(css, '.dou-dialog__header + .dou-dialog__body')).toBe('padding-top: 8px;')
    const elsewhere = css.replace(/\.dou-dialog__header \+ \.dou-dialog__body \{[^}]*\}/, '')
    expect(elsewhere).not.toMatch(/\.dou-dialog__body[^{]*\{[^}]*padding[^;]*8px/)
  })

  it('leaves the body of a DialogBox to the shared rule', () => {
    expect(read('dialog-box.css')).not.toMatch(/\.dou-dialog__body\s*\{[^}]*padding/)
  })
})
