import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')
// A message starts with a quote, then a bracketed name: '[@dou-ui/chart] …'
const PREFIX = /['"`]\[(@?dou-ui[^\]\s'"`]*|Dou[A-Za-z]*)\]/g

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path)
    return /\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

describe('dev warning prefixes', () => {
  it('name the package the message comes from', () => {
    const wrong: string[] = []
    for (const pkg of readdirSync(root)) {
      let name: string
      try {
        name = JSON.parse(readFileSync(join(root, pkg, 'package.json'), 'utf8')).name
      } catch {
        continue
      }
      for (const file of sources(join(root, pkg, 'src'))) {
        for (const match of readFileSync(file, 'utf8').matchAll(PREFIX)) {
          if (match[1] !== name)
            wrong.push(`${relative(root, file)}: [${match[1]}]，应为 [${name}]`)
        }
      }
    }
    expect(wrong).toEqual([])
  })
})
