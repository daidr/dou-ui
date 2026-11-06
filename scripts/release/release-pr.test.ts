// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkReleaseChanges } from './release-pr'

describe('checkReleaseChanges', () => {
  const release = [
    'packages/dou-ui/package.json',
    'packages/theme/package.json',
    'bun.lock',
    'CHANGELOG.md',
    '.changes/prerelease/tabs-drag-dock.md',
    '.changes/tabs-drag-dock.md',
  ]

  it('accepts versions, the lockfile and the changelog on top of main', () => {
    expect(checkReleaseChanges(release, true)).toEqual([])
  })

  it('refuses any other file', () => {
    const problems = checkReleaseChanges(
      [...release, 'packages/dou-ui/src/index.ts', 'scripts/release.ts'],
      true,
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('packages/dou-ui/src/index.ts、scripts/release.ts')
  })

  it('refuses a branch that is not on top of main', () => {
    expect(checkReleaseChanges(release, false)).toHaveLength(1)
  })
})
