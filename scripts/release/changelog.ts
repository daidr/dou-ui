import { compareVersions, parseVersion } from './version'
import { sorted } from './sorted'

/** Kinds of change, in the order a release lists them. */
export const changeTypes = ['说明', '不兼容', '新增', '改进', '修复', '性能'] as const
export type ChangeType = (typeof changeTypes)[number]

export interface Fragment {
  /** File name without `.md`. */
  name: string
  type: ChangeType
  /** Package directory names under `packages/`, e.g. `sheet`. */
  packages: string[]
  body: string
  /** Pull request that added it, when known. */
  pr?: number
  /** The prerelease that first shipped it. */
  version?: string
}

export interface RenderContext {
  /** `https://github.com/owner/repo`, for pull request links. */
  repoUrl: string
  /** Package directory name → npm name. */
  packageNames: Record<string, string>
}

/** Parses a fragment file; throws with a message that names the problem. */
export function parseFragment(name: string, text: string): Fragment {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!match) throw new Error(`${name}.md 缺少开头的 --- 元数据块。`)
  const meta: Record<string, string> = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const pair = /^([a-z]+):\s*(.*)$/.exec(line.trim())
    if (!pair) throw new Error(`${name}.md 的元数据行无法识别：${line}`)
    meta[pair[1]!] = pair[2]!.trim()
  }
  const type = meta.type as ChangeType | undefined
  if (!type || !changeTypes.includes(type)) {
    throw new Error(`${name}.md 的 type 必须是 ${changeTypes.join('、')} 之一。`)
  }
  const packages = (meta.packages ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
  const body = match[2]!.trim()
  if (!body) throw new Error(`${name}.md 没有正文。`)
  const fragment: Fragment = { name, type, packages, body }
  if (meta.pr) fragment.pr = Number(meta.pr)
  if (meta.version) fragment.version = meta.version
  return fragment
}

export function formatFragment(fragment: Fragment): string {
  const lines = ['---', `type: ${fragment.type}`]
  if (fragment.packages.length) lines.push(`packages: [${fragment.packages.join(', ')}]`)
  if (fragment.pr) lines.push(`pr: ${fragment.pr}`)
  if (fragment.version) lines.push(`version: ${fragment.version}`)
  lines.push('---', '', fragment.body, '')
  return lines.join('\n')
}

/** Problems with the package names a fragment uses. */
export function checkPackages(fragment: Fragment, ctx: RenderContext): string[] {
  return fragment.packages
    .filter((dir) => !(dir in ctx.packageNames))
    .map(
      (dir) =>
        `${fragment.name}.md 里的包 ${dir} 不存在，可用的有：${Object.keys(ctx.packageNames).join('、')}。`,
    )
}

const byName = (a: Fragment, b: Fragment) =>
  (a.pr ?? Infinity) - (b.pr ?? Infinity) || a.name.localeCompare(b.name)

function renderItem(fragment: Fragment, ctx: RenderContext): string {
  const scope = fragment.packages.length
    ? `**${fragment.packages.map((dir) => ctx.packageNames[dir] ?? dir).join('、')}**：`
    : ''
  const link = fragment.pr ? ` ([#${fragment.pr}](${ctx.repoUrl}/pull/${fragment.pr}))` : ''
  const [first, ...rest] = fragment.body.split('\n')
  return [
    `- ${scope}${first}${rest.length ? '' : link}`,
    ...rest.map((line, i) => {
      const text = line ? `  ${line}` : ''
      return i === rest.length - 1 ? `${text}${link}` : text
    }),
  ].join('\n')
}

/** The body of one version's section: notes first, then each kind of change. */
export function renderChanges(fragments: Fragment[], ctx: RenderContext): string {
  const parts: string[] = []
  for (const type of changeTypes) {
    const items = sorted(
      fragments.filter((fragment) => fragment.type === type),
      byName,
    )
    if (!items.length) continue
    if (type === '说明') {
      parts.push(...items.map((item) => item.body))
    } else {
      parts.push(`### ${type}\n\n${items.map((item) => renderItem(item, ctx)).join('\n')}`)
    }
  }
  return parts.join('\n\n')
}

interface Section {
  version: string
  text: string
}

/** Splits a changelog into the text before the first version and its sections. */
export function splitChangelog(text: string): { intro: string; sections: Section[] } {
  const parts = text.split(/^(?=## )/m)
  const intro = parts[0]!.startsWith('## ') ? '' : parts.shift()!
  return {
    intro,
    sections: parts.map((part) => ({ version: /^## (\S+)/.exec(part)![1]!, text: part })),
  }
}

export interface ReleaseInput {
  changelog: string
  version: string
  date: string
  /** Fragments not released in any version yet. */
  pending: Fragment[]
  /** Fragments already shipped in a prerelease of an upcoming release. */
  prereleased: Fragment[]
  ctx: RenderContext
}

export interface ReleaseOutput {
  changelog: string
  /** The new section without its heading, for the GitHub release. */
  notes: string
}

/**
 * Adds a version's section to the changelog. A prerelease lists the pending
 * fragments; a release lists everything since the last release, and folds the
 * sections of its own prereleases into a collapsed block below it.
 */
export function releaseChangelog(input: ReleaseInput): ReleaseOutput {
  const version = parseVersion(input.version)
  if (!version) throw new Error(`版本号 ${input.version} 不合法。`)
  const { intro, sections } = splitChangelog(input.changelog)
  const pending = input.pending
  const kept = sections

  const fragments = version.pre ? pending : [...input.prereleased, ...pending]
  let notes = renderChanges(fragments, input.ctx)
  let folded: Section[] = []
  if (!version.pre) {
    const base = input.version
    folded = kept.filter((section) => {
      const v = parseVersion(section.version)
      return v?.pre && `${v.major}.${v.minor}.${v.patch}` === base
    })
    if (folded.length) {
      const inner = folded
        .map((section) => section.text.trim().replace(/^(#{2,5}) /gm, '#$1 '))
        .join('\n\n')
      const first = folded.at(-1)!.version
      const last = folded[0]!.version
      notes += `\n\n<details>\n<summary>预发布版本（${first === last ? first : `${first} 至 ${last}`}）</summary>\n\n${inner}\n\n</details>`
    }
  }
  notes = notes.trim() || '没有记录的改动。'
  const heading = `## ${input.version} · ${input.date}`
  const rest = kept.filter((section) => !folded.includes(section))
  // Keep versions newest first even when a maintenance release lands later.
  const insertAt = rest.findIndex((section) => {
    const v = parseVersion(section.version)
    return !v || compareVersions(v, version) < 0
  })
  const next = [...rest]
  next.splice(insertAt < 0 ? next.length : insertAt, 0, {
    version: input.version,
    text: `${heading}\n\n${notes}\n\n`,
  })
  const body = next.map((section) => `${section.text.trimEnd()}\n\n`).join('')
  return { changelog: `${intro.trimEnd()}\n\n${body}`.trimEnd() + '\n', notes }
}
