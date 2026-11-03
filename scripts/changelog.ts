/**
 * Changelog fragments: every pull request that changes a package adds a file
 * to `.changes/`, and a release turns them into one section of CHANGELOG.md.
 *
 *   bun run changelog add [名字] [--type 新增] [--packages sheet,editor] [--body 正文]
 *   bun run changelog check [--base origin/main]
 *   bun run changelog preview [版本号]
 */
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  changeTypes,
  checkPackages,
  formatFragment,
  releaseChangelog,
  renderChanges,
  type ChangeType,
} from './release/changelog'
import { changesDir, git, prereleaseDir, readFragments, renderContext, root } from './release/repo'

const print = (text: string) => process.stdout.write(`${text}\n`)

const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    type: { type: 'string' },
    packages: { type: 'string' },
    body: { type: 'string' },
    base: { type: 'string' },
  },
})
const [command, arg] = positionals

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function ask(question: string, fallback?: string): string {
  if (fallback !== undefined) return fallback
  if (!process.stdin.isTTY) fail(`缺少参数：${question}`)
  return (prompt(question) ?? '').trim()
}

/** Every fragment parses and names real packages. */
function validate(): string[] {
  const ctx = renderContext()
  const problems: string[] = []
  for (const dir of [changesDir, prereleaseDir]) {
    try {
      for (const fragment of readFragments(dir)) problems.push(...checkPackages(fragment, ctx))
    } catch (error) {
      problems.push((error as Error).message)
    }
  }
  return problems
}

/** Source files whose change users can notice. */
const isPackageSource = (path: string) =>
  /^packages\/[^/]+\/(src|style|styles)\//.test(path) &&
  !/(__tests__|\.test\.ts$|\.spec\.ts$)/.test(path)

switch (command) {
  case 'add': {
    const name = ask('文件名（英文短横线，如 sheet-comments）：', arg)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) fail('文件名只能用小写字母、数字和短横线。')
    const file = join(changesDir, `${name}.md`)
    if (existsSync(file)) fail(`.changes/${name}.md 已存在。`)
    const type = ask(`类型（${changeTypes.join(' / ')}）：`, values.type) as ChangeType
    if (!changeTypes.includes(type)) fail(`类型必须是 ${changeTypes.join('、')} 之一。`)
    // Given on the command line without --packages: no package in particular.
    const scripted = values.type !== undefined || values.body !== undefined
    const packages = ask(
      '涉及的包目录名，逗号分隔（如 sheet,editor，可留空）：',
      values.packages ?? (scripted ? '' : undefined),
    )
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const body = ask('一句话说明改动：', values.body)
    if (!body) fail('正文不能为空。')
    const fragment = { name, type, packages, body }
    const problems = checkPackages(fragment, renderContext())
    if (problems.length) fail(problems.join('\n'))
    writeFileSync(file, formatFragment(fragment))
    print(`已写入 .changes/${name}.md`)
    break
  }
  case 'check': {
    const problems = validate()
    if (values.base) {
      const changed = git('diff', '--name-only', `${values.base}...HEAD`)
        .split('\n')
        .filter(Boolean)
      const labels = (process.env.PR_LABELS ?? '').split(',').map((label) => label.trim())
      const skip = labels.includes('无需记录')
      const release = (process.env.GITHUB_HEAD_REF ?? '').startsWith('release-pr/')
      if (!release && !skip && changed.includes('CHANGELOG.md')) {
        problems.push('不要直接改 CHANGELOG.md：改动记在 .changes/ 里，发版时会自动汇总。')
      }
      const source = changed.filter(isPackageSource)
      const touched = new Set(source.map((path) => path.split('/')[1]))
      const added = git('diff', '--name-only', '--diff-filter=AMR', `${values.base}...HEAD`)
        .split('\n')
        .some((path) => /^\.changes\/[^/]+\.md$/.test(path) && !path.endsWith('README.md'))
      if (source.length && !added && !skip && !release) {
        problems.push(
          [
            `这个 PR 改了 ${touched.size} 个包的源码（${source.length} 个文件，如 ${source[0]}），但没有在 .changes/ 里加改动说明。`,
            '运行 bun run changelog add 添加一条；如果改动用户感觉不到（纯重构、测试），给 PR 加上「无需记录」标签。',
          ].join('\n'),
        )
      }
    }
    if (problems.length) fail(problems.join('\n'))
    print('changelog 检查通过。')
    break
  }
  case 'preview': {
    const problems = validate()
    if (problems.length) fail(problems.join('\n'))
    const ctx = renderContext()
    if (!arg) {
      print(renderChanges(readFragments(changesDir), ctx) || '没有待发布的改动。')
      break
    }
    const { notes } = releaseChangelog({
      changelog: await Bun.file(join(root, 'CHANGELOG.md')).text(),
      version: arg,
      date: new Date().toISOString().slice(0, 10),
      pending: readFragments(changesDir),
      prereleased: readFragments(prereleaseDir),
      ctx,
    })
    print(notes)
    break
  }
  default:
    fail('用法：bun run changelog <add | check | preview> …')
}
