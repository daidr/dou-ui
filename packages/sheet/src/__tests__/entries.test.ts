import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(new URL(import.meta.url).pathname)
const packages = resolve(here, '../../..')

// what a module loads when it runs: imports and re-exports that aren't only types
const RUNTIME = /^(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm

function resolveFile(from: string, spec: string) {
  const base = resolve(dirname(from), spec)
  const file = [`${base}.ts`, `${base}/index.ts`, base].find(existsSync)
  if (!file) throw new Error(`can't find ${spec} from ${from}`)
  return file
}

/** The packages and `.vue` files a module loads, following its own files. */
function loaded(entry: string, aliases: Record<string, string> = {}) {
  const seen = new Set<string>()
  const outside = new Set<string>()
  const visit = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(RUNTIME)) {
      if (spec!.endsWith('.vue')) outside.add(spec!)
      else if (spec!.startsWith('.')) visit(resolveFile(file, spec!))
      else if (aliases[spec!]) visit(aliases[spec!]!)
      else outside.add(spec!)
    }
  }
  visit(entry)
  return [...outside]
}

describe('entries that load no components', () => {
  it('@dou-ui/sheet/core loads neither Vue nor the components', () => {
    expect(loaded(resolve(packages, 'sheet/src/core/index.ts'))).toEqual(['@dou-ui/theme'])
  })

  it('@dou-ui/sheet/formula loads nothing else', () => {
    expect(loaded(resolve(packages, 'sheet/src/formula/index.ts'))).toEqual([])
  })

  it('@dou-ui/sheet-xlsx loads neither Vue nor the components', () => {
    const aliases = {
      '@dou-ui/sheet/core': resolve(packages, 'sheet/src/core/index.ts'),
      '@dou-ui/sheet/formula': resolve(packages, 'sheet/src/formula/index.ts'),
    }
    expect(loaded(resolve(packages, 'sheet-xlsx/src/index.ts'), aliases)).toEqual(['@dou-ui/theme'])
  })
})
