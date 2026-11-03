// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readPackages, sortByDependencies } from './workspace'

describe('sortByDependencies', () => {
  it('puts every package after the ones it needs', () => {
    const sorted = sortByDependencies([
      { name: 'editor', internal: ['code', 'ui'] },
      { name: 'code', internal: ['ui'] },
      { name: 'ui', internal: ['theme'] },
      { name: 'theme', internal: [] },
    ])
    expect(sorted.map((pkg) => pkg.name)).toEqual(['theme', 'ui', 'code', 'editor'])
  })

  it('refuses a cycle', () => {
    expect(() =>
      sortByDependencies([
        { name: 'a', internal: ['b'] },
        { name: 'b', internal: ['a'] },
      ]),
    ).toThrow('循环依赖')
  })
})

describe('readPackages', () => {
  it('lists the published packages of this repository in a publishable order', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url))
    const packages = readPackages(root)
    const position = new Map(packages.map((pkg, index) => [pkg.name, index]))
    expect(position.has('dou-ui')).toBe(true)
    for (const pkg of packages) {
      for (const dep of pkg.internal)
        expect(position.get(dep)!).toBeLessThan(position.get(pkg.name)!)
    }
    // all packages share one version
    expect(new Set(packages.map((pkg) => pkg.version)).size).toBe(1)
  })
})
