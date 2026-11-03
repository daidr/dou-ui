import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { formatFragment, parseFragment, type Fragment, type RenderContext } from './changelog'
import { readPackages } from './workspace'
import { sorted } from './sorted'

export const root = new URL('../../', import.meta.url).pathname
export const changesDir = join(root, '.changes')
export const prereleaseDir = join(changesDir, 'prerelease')

/** Runs git in the repository and returns its trimmed output. */
export function git(...args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd: root, stderr: 'pipe' })
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} 失败：${result.stderr.toString().trim()}`)
  }
  return result.stdout.toString().trim()
}

export function renderContext(): RenderContext {
  const main = JSON.parse(readFileSync(join(root, 'packages/dou-ui/package.json'), 'utf8'))
  const repoUrl = String(main.repository?.url ?? '')
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
  return {
    repoUrl,
    packageNames: Object.fromEntries(readPackages(root).map((pkg) => [pkg.dir, pkg.name])),
  }
}

const fragmentFiles = (dir: string) =>
  existsSync(dir)
    ? sorted(readdirSync(dir).filter((file) => file.endsWith('.md') && file !== 'README.md'))
    : []

/** The pull request whose squash commit added a file, from its `(#123)` suffix. */
export function prThatAdded(path: string): number | undefined {
  const subjects = git('log', '--diff-filter=A', '--format=%s', '--', path).split('\n')
  const match = /\(#(\d+)\)\s*$/.exec(subjects.at(-1) ?? '')
  return match ? Number(match[1]) : undefined
}

export function readFragments(dir: string): Fragment[] {
  return fragmentFiles(dir).map((file) => {
    const fragment = parseFragment(file.slice(0, -3), readFileSync(join(dir, file), 'utf8'))
    fragment.pr ??= prThatAdded(join(dir, file))
    return fragment
  })
}

/** Moves pending fragments into `prerelease/`, recording their PR and version. */
export function markPrereleased(fragments: Fragment[], version: string): void {
  mkdirSync(prereleaseDir, { recursive: true })
  for (const fragment of fragments) {
    const target = join(prereleaseDir, `${fragment.name}.md`)
    renameSync(join(changesDir, `${fragment.name}.md`), target)
    writeFileSync(target, formatFragment({ ...fragment, version }))
  }
}
