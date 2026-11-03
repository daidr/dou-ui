import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DashboardTransaction, useDashboardWidget } from '..'

const PREFIX = '[@dou-ui/dashboard] '
const root = join(dirname(new URL(import.meta.url).pathname), '..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path)
    return /\.(ts|vue)$/.test(name) ? [path] : []
  })
}

/** The text between the parenthesis at `open` and the one that closes it. */
function argumentsAt(text: string, open: number) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')' && --depth === 0) return text.slice(open + 1, i)
  }
  return text.slice(open + 1)
}

/**
 * Each message the package throws or warns with: string literals that start the first
 * argument, or one branch of a `?:` in it.
 */
function messages(text: string) {
  const found: string[] = []
  const call = /(?:new\s+[\w.]*Error|console\.(?:warn|error))\s*\(/g
  for (const match of text.matchAll(call)) {
    const args = argumentsAt(text, match.index + match[0].length - 1)
    for (const literal of args.matchAll(/(?:^|[?:])\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g))
      found.push(literal[2]!)
  }
  return found
}

describe('error and warning messages', () => {
  it('all start with the package prefix', () => {
    const missing: string[] = []
    let count = 0
    for (const file of sources(root)) {
      for (const message of messages(readFileSync(file, 'utf8'))) {
        count++
        if (!message.startsWith(PREFIX)) missing.push(`${relative(root, file)}: ${message}`)
      }
    }
    expect(count).toBeGreaterThan(10)
    expect(missing).toEqual([])
  })

  it('carry the prefix when thrown', () => {
    expect(() => useDashboardWidget()).toThrow(PREFIX)
    const tr = new DashboardTransaction({
      version: 1,
      widgets: [{ id: 'a', type: 'note', place: { lg: { x: 0, y: 0, w: 3, h: 2 } } }],
    })
    expect(() => tr.update('a', { id: 'b' } as never)).toThrow(PREFIX)
  })
})
