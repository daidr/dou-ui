/**
 * Decide which prerelease the release pull request kept by release-pr.yml
 * proposes. Writes `version=<x>` to $GITHUB_OUTPUT, empty when there is
 * nothing to release, and `waiting=true` while the last release is unfinished.
 *
 *   bun scripts/release/auto.ts
 */
import { appendFileSync } from 'node:fs'
import { changesDir, git, readFragments, root } from './repo'
import { formatVersion, nextPrerelease, parseVersion } from './version'
import { readPackages } from './workspace'

function output(version: string, waiting = false) {
  if (!process.env.GITHUB_OUTPUT) return
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nwaiting=${waiting}\n`)
}

function skip(message: string, waiting = false): never {
  process.stdout.write(`${message}\n`)
  output('', waiting)
  process.exit(0)
}

const current = readPackages(root).find((pkg) => pkg.name === 'dou-ui')!.version
const parsed = parseVersion(current)
if (!parsed) {
  console.error(`当前版本号 ${current} 不合法。`)
  process.exit(1)
}
// main carries a release commit whose publish has not finished yet (the
// Release run is usually still going): the next version waits for its tag.
if (current !== '0.0.0' && !git('tag', '--list', `v${current}`)) {
  skip(`::notice title=等待上一版发布::v${current} 还没有 tag，等它发布完成后再准备下一版。`, true)
}
const pending = readFragments(changesDir)
if (!pending.length) skip(`v${current} 之后没有新的改动记录，不发版。`)

const next = formatVersion(nextPrerelease(parsed))
process.stdout.write(`准备发布 ${next}：${pending.length} 条改动。\n`)
output(next)
