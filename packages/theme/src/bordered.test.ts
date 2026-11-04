import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const packages = resolve(here, '../..')

/**
 * The components whose frame `bordered` turns off. Off, the frame must be
 * gone entirely, `border: 0`, not drawn in a transparent color: a
 * transparent border still takes a pixel and comes back with a focus color.
 */
const framed: [file: string, block: string][] = [
  ['theme/src/components/table.css', '.dou-table'],
  ['theme/src/components/code-block.css', '.dou-code-block'],
  ['theme/src/components/qrcode.css', '.dou-qrcode'],
  ['theme/src/components/calendar-view.css', '.dou-calendar-view'],
  ['theme/src/components/descriptions.css', '.dou-descriptions--table'],
  ['code/src/style.css', '.dou-code-editor'],
  ['code/src/style.css', '.dou-code-diff'],
  ['flow/src/style.css', '.dou-flow-editor'],
  ['gantt/src/style.css', '.dou-gantt'],
  ['sheet/src/style.css', '.dou-sheet'],
  ['pivot/src/style.css', '.dou-pivot'],
  ['form-builder/src/builder/style.css', '.dou-form-builder'],
]

/** The text of the first rule opened by `head`, braces balanced. */
function ruleOf(css: string, head: RegExp): string | undefined {
  const match = head.exec(css)
  if (!match) return undefined
  let depth = 0
  for (let i = match.index; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(match.index, i + 1)
  }
  return undefined
}

describe('bordered', () => {
  for (const [file, block] of framed) {
    it(`${block} drops its whole frame without is-bordered`, () => {
      const css = readFileSync(resolve(packages, file), 'utf8')
      const escaped = block.replace(/[.-]/g, (c) => `\\${c}`)
      const root = ruleOf(css, new RegExp(`^\\s*${escaped}\\s*\\{`, 'm'))
      // nested in the component's own rule, or written out as `.dou-x:not(.is-bordered)`
      const off =
        (root && ruleOf(root, /&:not\(\.is-bordered\)\s*\{/)) ??
        ruleOf(css, new RegExp(`${escaped}:not\\(\\.is-bordered\\)[^{,]*\\{`))
      expect(off, `${file}: no rule for ${block} without is-bordered`).toBeDefined()
      expect(off).toMatch(/border:\s*0;/)
      expect(off).toMatch(/border-radius:\s*0;/)
    })
  }
})
