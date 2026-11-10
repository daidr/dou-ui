import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, 'components/table.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the rule whose selector list includes this selector. */
function rule(selector: string) {
  const at = css.indexOf(selector)
  if (at < 0) throw new Error(`no rule for ${selector}`)
  const start = css.indexOf('{', at)
  return css.slice(start, css.indexOf('}', start))
}

describe('fixed columns in a pinned header', () => {
  it('stay above the body’s fixed cells while the body scrolls', () => {
    // the pinned header puts every header cell at z-index 1 with this specificity
    expect(rule('.dou-table.is-scroll .dou-table__head .dou-table__cell {')).toMatch(/z-index:\s*1/)
    for (const side of ['start', 'end']) {
      expect(
        rule(`.dou-table.is-scroll .dou-table__head .dou-table__cell.is-fixed-${side}`),
      ).toMatch(/z-index:\s*3/)
    }
  })
})
