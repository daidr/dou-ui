/**
 * Pack every published package into `.release/` and check the tarballs:
 * the version, no `workspace:` left, sibling packages pinned to the same
 * version, and built files present. Run after `bun run build`.
 *
 *   bun run release:pack
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { splitChangelog } from './changelog'
import { root } from './repo'
import { channelOf, parseVersion } from './version'
import { readPackages } from './workspace'

const print = (text: string) => process.stdout.write(`${text}\n`)

export interface ManifestEntry {
  name: string
  version: string
  /** Tarball path relative to `.release/`. */
  file: string
}

const out = join(root, '.release')
mkdirSync(out, { recursive: true })
for (const file of new Bun.Glob('*.tgz').scanSync(out)) rmSync(join(out, file))

const packages = readPackages(root)
const version = packages[0]!.version
const parsed = parseVersion(version)
if (!parsed || version === '0.0.0') {
  console.error(`当前版本号 ${version} 不能发布：先运行 bun run release <版本号>。`)
  process.exit(1)
}
const names = new Set(packages.map((pkg) => pkg.name))
const problems: string[] = []
const entries: ManifestEntry[] = []

for (const pkg of packages) {
  if (pkg.version !== version)
    problems.push(`${pkg.name} 的版本是 ${pkg.version}，不是 ${version}。`)
  const packed = Bun.spawnSync(['bun', 'pm', 'pack', '--destination', out, '--quiet'], {
    cwd: pkg.path,
    stderr: 'pipe',
  })
  if (packed.exitCode !== 0) {
    problems.push(`${pkg.name} 打包失败：${packed.stderr.toString().trim()}`)
    continue
  }
  const file = packed.stdout.toString().trim().split('\n').at(-1)!.split('/').at(-1)!
  const tarball = join(out, file)
  const listing = Bun.spawnSync(['tar', '-tzf', tarball]).stdout.toString().split('\n')
  const manifest = JSON.parse(
    Bun.spawnSync(['tar', '-xzOf', tarball, 'package/package.json']).stdout.toString(),
  )
  if (manifest.version !== version) problems.push(`${file} 里的版本是 ${manifest.version}。`)
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dep, range] of Object.entries<string>(manifest[field] ?? {})) {
      if (range.startsWith('workspace:'))
        problems.push(`${file} 的 ${field}.${dep} 仍是 ${range}。`)
      else if (names.has(dep) && range !== version) {
        problems.push(`${file} 的 ${field}.${dep} 是 ${range}，应为 ${version}。`)
      }
    }
  }
  if (!listing.some((path) => path.startsWith('package/dist/'))) {
    problems.push(`${file} 里没有 dist/，是否忘了先运行 bun run build？`)
  }
  for (const required of ['package/LICENSE', 'package/README.md']) {
    if (!listing.includes(required)) {
      problems.push(`${file} 里缺少 ${required.slice('package/'.length)}。`)
    }
  }
  entries.push({ name: pkg.name, version, file })
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(entries, null, 2)}\n`)
// The GitHub release uses this version's section of the changelog as merged.
const section = splitChangelog(readFileSync(join(root, 'CHANGELOG.md'), 'utf8')).sections.find(
  (item) => item.version === version,
)
if (!section) {
  console.error(`CHANGELOG.md 里没有 ${version} 一节。`)
  process.exit(1)
}
writeFileSync(join(out, 'notes.md'), `${section.text.replace(/^## .*\n/, '').trim()}\n`)
print(`已打包 ${entries.length} 个包（${version}，${channelOf(parsed)}）到 .release/。`)
