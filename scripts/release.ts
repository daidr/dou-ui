/**
 * Prepare a release: check the version, bump every published package (and
 * bun.lock) to it and turn the changelog fragments into its section of
 * CHANGELOG.md. The release workflow publishes once this change is merged.
 *
 *   bun run release 0.1.0-alpha.0
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { releaseChangelog } from './release/changelog'
import {
  changesDir,
  git,
  markPrereleased,
  prereleaseDir,
  readFragments,
  renderContext,
  root,
} from './release/repo'
import { channelOf, checkNextVersion, parseVersion } from './release/version'
import { readPackages } from './release/workspace'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const version = process.argv[2]
if (!version) fail('用法：bun run release <版本号>，例如 bun run release 0.1.0-alpha.0')

const packages = readPackages(root)
const current = packages.find((pkg) => pkg.name === 'dou-ui')!.version
const stray = packages.filter((pkg) => pkg.version !== current)
if (stray.length) {
  fail(
    `各包版本不一致：${stray.map((pkg) => `${pkg.name}@${pkg.version}`).join('、')}，dou-ui 是 ${current}。`,
  )
}
// In the prepare workflow the branch comes from the run; locally from git.
const branch = process.env.GITHUB_REF_NAME || git('rev-parse', '--abbrev-ref', 'HEAD')
const problem = checkNextVersion(current, version, branch)
if (problem) fail(problem)
if (git('tag', '--list', `v${version}`)) fail(`tag v${version} 已经存在。`)

const changelogFile = Bun.file(join(root, 'CHANGELOG.md'))
const changelogText = await changelogFile.text()
if (/^## 未发布/m.test(changelogText)) {
  fail('CHANGELOG.md 里还有「## 未发布」一节：把内容移到 .changes/ 的碎片文件里再发布。')
}

const ctx = renderContext()
const pending = readFragments(changesDir)
const prereleased = readFragments(prereleaseDir)
const isPre = parseVersion(version)!.pre !== null
const { changelog, notes } = releaseChangelog({
  changelog: changelogText,
  version,
  date: new Date().toISOString().slice(0, 10),
  pending,
  prereleased,
  ctx,
})

for (const pkg of packages) {
  const file = Bun.file(join(pkg.path, 'package.json'))
  const manifest = await file.json()
  manifest.version = version
  await Bun.write(file, `${JSON.stringify(manifest, null, 2)}\n`)
}
// bun.lock records each workspace package's version; keep it in step.
const lock = Bun.spawnSync(['bun', 'install', '--lockfile-only'], {
  cwd: root,
  stdout: 'ignore',
  stderr: 'pipe',
})
if (lock.exitCode !== 0) fail(`更新 bun.lock 失败：\n${lock.stderr.toString()}`)
await Bun.write(changelogFile, changelog)
if (isPre) {
  markPrereleased(pending, version)
} else {
  for (const fragment of pending) rmSync(join(changesDir, `${fragment.name}.md`))
  for (const fragment of prereleased) rmSync(join(prereleaseDir, `${fragment.name}.md`))
}
mkdirSync(join(root, '.release'), { recursive: true })
writeFileSync(join(root, '.release/notes.md'), `${notes}\n`)

process.stdout
  .write(`已准备 ${version}（${channelOf(parseVersion(version)!)}）：${packages.length} 个包，${pending.length + (isPre ? 0 : prereleased.length)} 条改动。
发布说明写在 .release/notes.md。合并这个改动后，发版工作流会等你批准再发布到 npm。
`)
