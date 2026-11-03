/**
 * Publish the tarballs in `.release/` to npm, dependencies first. Versions
 * already on the registry are skipped, so a failed run can simply be re-run.
 *
 *   bun run release:publish            # from the release workflow, with provenance
 *   bun run release:publish --dry-run  # check everything, publish nothing
 *
 * In GitHub Actions it writes `tag` (the dist-tag used) and `version` to the
 * step outputs.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import type { ManifestEntry } from './pack'
import { root } from './repo'
import { compareVersions, distTagFor, parseVersion } from './version'

const print = (text: string) => process.stdout.write(`${text}\n`)

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { 'dry-run': { type: 'boolean', default: false } },
})
const dryRun = values['dry-run']
const out = join(root, '.release')

function run(args: string[], options: { quiet?: boolean } = {}) {
  const result = Bun.spawnSync(args, {
    cwd: out,
    stdout: options.quiet ? 'pipe' : 'inherit',
    stderr: options.quiet ? 'pipe' : 'inherit',
  })
  return { ok: result.exitCode === 0, stdout: result.stdout?.toString() ?? '' }
}

/** The registry's dist-tags of a package, or `{}` when it does not exist yet. */
function distTags(name: string): Record<string, string> {
  const result = run(['npm', 'view', name, 'dist-tags', '--json'], { quiet: true })
  if (!result.ok || !result.stdout.trim()) return {}
  return JSON.parse(result.stdout)
}

function published(name: string, version: string): boolean {
  const result = run(['npm', 'view', `${name}@${version}`, 'version', '--json'], { quiet: true })
  return result.ok && result.stdout.includes(version)
}

const entries: ManifestEntry[] = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'))
const version = entries[0]!.version
const parsed = parseVersion(version)!

const npmVersion = parseVersion(run(['npm', '--version'], { quiet: true }).stdout.trim())
if (!dryRun && (!npmVersion || compareVersions(npmVersion, parseVersion('11.5.1')!) < 0)) {
  console.error('发布需要 npm 11.5.1 或更新的版本（可信发布）。')
  process.exit(1)
}

const latest = parseVersion(distTags('dou-ui').latest ?? '')
const tag = distTagFor(parsed, latest)
print(`发布 ${version}，dist-tag：${tag}${dryRun ? '（演练）' : ''}`)

let failed = 0
for (const entry of entries) {
  if (published(entry.name, entry.version)) {
    print(`跳过 ${entry.name}@${entry.version}：已在 npm 上。`)
    continue
  }
  const args = ['npm', 'publish', entry.file, '--tag', tag, '--access', 'public']
  if (dryRun) args.push('--dry-run')
  // Fails outright rather than publishing without provenance, e.g. from a
  // private repository or with a token outside GitHub Actions.
  else if (process.env.GITHUB_ACTIONS) args.push('--provenance')
  print(`\n$ ${args.join(' ')}`)
  if (!run(args).ok) {
    failed++
    // Later packages depend on earlier ones; stop rather than publish half a set.
    break
  }
}
if (failed) {
  console.error('\n发布中断。修好问题后重新运行，已经发布的包会被跳过。')
  process.exit(1)
}

/**
 * Dist-tags to move after publishing, per package:
 * - a release should not leave `@beta` or `@alpha` installing something older;
 * - before a package's first release, npm keeps `latest` on whichever
 *   prerelease came first, so a newer prerelease takes it over.
 */
function staleTags(tags: Record<string, string>): string[] {
  const older = (name: string) => {
    const current = parseVersion(tags[name] ?? '')
    return !!current && compareVersions(current, parsed) < 0
  }
  if (tag === 'latest') return ['beta', 'alpha'].filter(older)
  const latestOfPackage = parseVersion(tags.latest ?? '')
  return latestOfPackage?.pre && older('latest') ? ['latest'] : []
}

const manual: string[] = []
if (!dryRun) {
  for (const entry of entries) {
    for (const channel of staleTags(distTags(entry.name))) {
      const command = ['npm', 'dist-tag', 'add', `${entry.name}@${version}`, channel]
      print(`$ ${command.join(' ')}`)
      if (!run(command, { quiet: true }).ok) manual.push(command.join(' '))
    }
  }
}
if (manual.length) {
  // The packages are out, so the run stays green; the annotation makes the
  // leftover step visible on the run's summary page.
  const message = `以下 dist-tag 没能移动，请在本地登录 npm 后手动运行：${manual.join('；')}`
  print(process.env.GITHUB_ACTIONS ? `::warning title=dist-tag 未移动::${message}` : message)
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\nversion=${version}\n`)
}
print(dryRun ? '\n演练完成，没有发布任何包。' : `\n已发布 ${entries.length} 个包的 ${version}。`)
