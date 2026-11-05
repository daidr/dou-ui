import { fileURLToPath } from 'node:url'
import { globSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dark, flattenTokens, light } from './index'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

const sources = [
  ...globSync('packages/*/src/**/*.{css,vue,ts}', { cwd: root }),
  ...globSync('docs/examples/**/*.vue', { cwd: root }),
].filter((file) => !file.includes('/generated/') && !file.includes('node_modules'))

/** Every `--dou-*` a stylesheet can rely on: the theme's tokens and the variables components set themselves. */
function definedVariables(): Set<string> {
  const names = new Set([...flattenTokens(light), ...flattenTokens(dark)].map(([name]) => name))
  for (const file of sources) {
    const code = readFileSync(resolve(root, file), 'utf8')
    // a declaration in CSS or a style object: `--dou-x: …`, `'--dou-x': …`
    for (const match of code.matchAll(/(--dou-[a-z0-9-]+)['"]?\s*:/g)) names.add(match[1]!)
    // set from script, e.g. style.setProperty('--dou-x', …)
    for (const match of code.matchAll(/['"`](--dou-[a-z0-9-]+)['"`]/g)) names.add(match[1]!)
  }
  return names
}

describe('CSS variables', () => {
  it('var(--dou-*) without a fallback names a variable that exists', () => {
    const defined = definedVariables()
    // an unknown variable makes the whole declaration invalid: the size, radius or color silently falls back to inherit or nothing
    const offenders = sources.flatMap((file) =>
      [...readFileSync(resolve(root, file), 'utf8').matchAll(/var\(\s*(--dou-[a-z0-9-]+)\s*\)/g)]
        .map((match) => match[1]!)
        .filter((name) => !defined.has(name))
        .map((name) => `${file}: ${name}`),
    )
    expect([...new Set(offenders)]).toEqual([])
  })
})
