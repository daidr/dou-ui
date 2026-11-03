import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')
// A message starts with a quote, then a bracketed name: '[@dou-ui/chart] …'
const PREFIX = /['"`]\[(@?dou-ui[^\]\s'"`]*|Dou[A-Za-z]*)\]/g
// The PNG export puts `scope` in brackets itself: { scope: '@dou-ui/chart' }
const SCOPE = /\bscope: ['"`](@?dou-ui[^'"`]*)['"`]/g
// Chinese, Japanese or Korean text
const CJK = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/
// Where a message for the developer starts: a thrown error or a console warning.
const MESSAGE = /(?:console\.(?:warn|error)|throw new (\w*Error))\(\s*/g
/**
 * Errors whose text is shown to the people using the app (a formula or an
 * expression they typed), not to the developer, so they carry no package name.
 */
const FOR_USERS = new Set([
  'ExpressionError',
  'CallError',
  'SheetFormulaSyntaxError',
  'PivotFormulaError',
])

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path)
    return /\.(ts|vue)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : []
  })
}

const packages = readdirSync(root).flatMap((dir) => {
  try {
    const { name } = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))
    return [{ name: name as string, files: sources(join(root, dir, 'src')) }]
  } catch {
    return []
  }
})

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length

describe('dev warning prefixes', () => {
  it('name the package the message comes from', () => {
    const wrong: string[] = []
    for (const { name, files } of packages) {
      for (const file of files) {
        const text = readFileSync(file, 'utf8')
        for (const match of [...text.matchAll(PREFIX), ...text.matchAll(SCOPE)]) {
          if (match[1] !== name)
            wrong.push(`${relative(root, file)}: [${match[1]}]，应为 [${name}]`)
        }
      }
    }
    expect(wrong).toEqual([])
  })

  it('are not left out of thrown errors and console warnings', () => {
    const missing: string[] = []
    for (const { name, files } of packages) {
      for (const file of files) {
        const text = readFileSync(file, 'utf8')
        for (const match of text.matchAll(MESSAGE)) {
          if (match[1] && FOR_USERS.has(match[1])) continue
          const rest = text.slice(match.index + match[0].length)
          // Only literal messages: a variable or a call passes on text made elsewhere.
          if (!/^['"`]/.test(rest)) continue
          // `${prefix(…)}…` and `${PREFIX} …` put the name in front through a constant.
          if (rest.startsWith(`[${name}]`, 1) || rest.startsWith('`${')) continue
          missing.push(`${relative(root, file)}:${lineOf(text, match.index)} 缺少 [${name}]`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('are written in English, like the rest of the packages', () => {
    const chinese: string[] = []
    for (const { files } of packages) {
      for (const file of files) {
        const text = readFileSync(file, 'utf8')
        for (const match of text.matchAll(MESSAGE)) {
          if (match[1] && FOR_USERS.has(match[1])) continue
          const rest = text.slice(match.index + match[0].length)
          const quote = rest[0]
          if (!quote || !`'"\``.includes(quote)) continue
          const end = rest.indexOf(quote, 1)
          if (CJK.test(rest.slice(1, end === -1 ? 200 : end)))
            chinese.push(`${relative(root, file)}:${lineOf(text, match.index)}`)
        }
      }
    }
    expect(chinese).toEqual([])
  })
})
