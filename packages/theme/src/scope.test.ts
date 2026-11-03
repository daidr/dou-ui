import { fileURLToPath } from 'node:url'
import { globSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const packages = resolve(here, '../..')

/** Splits a selector list at the commas outside parentheses. */
function splitList(list: string): string[] {
  const parts: string[] = []
  let depth = 0
  let part = ''
  for (const char of list) {
    if (char === '(') depth++
    else if (char === ')') depth--
    if (char === ',' && depth === 0) {
      parts.push(part.trim())
      part = ''
    } else {
      part += char
    }
  }
  parts.push(part.trim())
  return parts
}

/** The outermost selectors of a stylesheet: those not nested in another rule. */
function outerSelectors(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  // what each open brace belongs to: a style rule, an at-rule holding rules, or something to skip
  const stack: ('rule' | 'group' | 'skip')[] = []
  let prelude = ''
  for (const char of code) {
    if (char === '{') {
      const head = prelude.trim()
      prelude = ''
      if (stack.includes('skip') || /^@(keyframes|font-face|property|page)\b/.test(head)) {
        stack.push('skip')
      } else if (head.startsWith('@scope')) {
        // `@scope (.dou-…)` scopes everything inside it
        stack.push('rule')
      } else if (head.startsWith('@')) {
        stack.push('group')
      } else {
        if (!stack.includes('rule')) out.push(...splitList(head))
        stack.push('rule')
      }
    } else if (char === '}') {
      stack.pop()
      prelude = ''
    } else if (char === ';') {
      prelude = ''
    } else {
      prelude += char
    }
  }
  return out
}

// A rule that names only state classes (`.is-active`, `.has-…`) matches them
// in every component on the page: a pivot rule once took the focus ring off
// InputOTP's cells. Every outer selector names its component's own class.
describe('stylesheets', () => {
  it('scope every outer selector to a component class', () => {
    const offenders = globSync('*/src/**/*.css', { cwd: packages })
      .filter((file) => !file.includes('/generated/') && !file.includes('node_modules'))
      .flatMap((file) =>
        outerSelectors(readFileSync(resolve(packages, file), 'utf8'))
          .filter((selector) => !/\.dou-|data-dou-|:root\b|^(html|body)\b/.test(selector))
          .map((selector) => `${file}: ${selector}`),
      )
    expect(offenders).toEqual([])
  })
})
