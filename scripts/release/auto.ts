/**
 * Decide what the automatic prerelease publishes, for release-auto.yml.
 * Prints `version=<x>` (or nothing to publish) to $GITHUB_OUTPUT.
 *
 *   bun scripts/release/auto.ts
 */
import { appendFileSync } from 'node:fs'
import { changesDir, git, readFragments, root } from './repo'
import { formatVersion, nextPrerelease, parseVersion } from './version'
import { readPackages } from './workspace'

function output(version: string) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`)
}

function skip(message: string): never {
  process.stdout.write(`${message}\n`)
  output('')
  process.exit(0)
}

const current = readPackages(root).find((pkg) => pkg.name === 'dou-ui')!.version
const parsed = parseVersion(current)
if (!parsed) {
  console.error(`当前版本号 ${current} 不合法。`)
  process.exit(1)
}
// A release commit whose publish has not finished: publishing on top of it
// would leave that version half released.
if (current !== '0.0.0' && !git('tag', '--list', `v${current}`)) {
  console.error(
    `::error title=上一版还没发完::main 上的版本是 ${current}，但没有 v${current} 这个 tag。先在那次 Release 运行里重跑失败的 job，发完后自动发版才会继续。`,
  )
  process.exit(1)
}
const pending = readFragments(changesDir)
if (!pending.length) skip(`v${current} 之后没有新的改动记录，不发版。`)

const next = formatVersion(nextPrerelease(parsed))
process.stdout.write(`准备发布 ${next}：${pending.length} 条改动。\n`)
output(next)
