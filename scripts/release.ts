/**
 * Prepare a release: bump every published package to the same version
 * and turn the "未发布" section of the changelog into that version.
 * Publishing, committing and tagging stay manual.
 *
 *   bun run release 0.1.0
 */
const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('用法：bun run release <版本号>，例如 bun run release 0.1.0')
  process.exit(1)
}

const root = new URL('../', import.meta.url).pathname
// in publish order: each package only depends on the ones before it
const packages = ['theme', 'icons', 'dou-ui', 'editor', 'flow', 'resolver', 'nuxt']

const changelog = Bun.file(`${root}CHANGELOG.md`)
const text = await changelog.text()
if (!text.includes('\n## 未发布\n')) {
  console.error('CHANGELOG.md 里没有「## 未发布」一节，先把改动记上再发布。')
  process.exit(1)
}

for (const name of packages) {
  const file = Bun.file(`${root}packages/${name}/package.json`)
  const pkg = await file.json()
  pkg.version = version
  await Bun.write(file, `${JSON.stringify(pkg, null, 2)}\n`)
}

const date = new Date().toISOString().slice(0, 10)
await Bun.write(
  changelog,
  text.replace('\n## 未发布\n', `\n## 未发布\n\n## ${version} · ${date}\n`),
)

process.stdout.write(`已更新到 ${version}。接下来：
  bun run check && bun run build
  git commit -am "release: v${version}" && git tag v${version}
${packages.map((name) => `  (cd packages/${name} && bun publish)`).join('\n')}
`)
