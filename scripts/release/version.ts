export type Channel = 'alpha' | 'beta' | 'latest'

export interface Version {
  major: number
  minor: number
  patch: number
  /** `null` for a release version. */
  pre: { channel: 'alpha' | 'beta'; number: number } | null
}

const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta)\.(0|[1-9]\d*))?$/

/** Parses `1.2.3`, `1.2.3-alpha.0` or `1.2.3-beta.4`; any other form is refused. */
export function parseVersion(text: string): Version | null {
  const match = pattern.exec(text)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? { channel: match[4] as 'alpha' | 'beta', number: Number(match[5]) } : null,
  }
}

export function formatVersion(version: Version): string {
  const base = `${version.major}.${version.minor}.${version.patch}`
  return version.pre ? `${base}-${version.pre.channel}.${version.pre.number}` : base
}

/** The npm dist-tag a version is published under. */
export function channelOf(version: Version): Channel {
  return version.pre ? version.pre.channel : 'latest'
}

const rank = { alpha: 0, beta: 1 } as const

/** Negative when `a` comes before `b`, following semver precedence. */
export function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  if (!a.pre || !b.pre) return (a.pre ? -1 : 0) - (b.pre ? -1 : 0)
  if (a.pre.channel !== b.pre.channel) return rank[a.pre.channel] - rank[b.pre.channel]
  return a.pre.number - b.pre.number
}

/** `0.3.0-beta.1` → `0.3.0`. */
export function baseOf(version: Version): string {
  return `${version.major}.${version.minor}.${version.patch}`
}

/**
 * Why `next` may not follow `current` from `branch`, or `null` when it may.
 * Prereleases come from `main` only; a release from `main` or `release/*`.
 */
export function checkNextVersion(current: string, next: string, branch: string): string | null {
  const to = parseVersion(next)
  if (!to) {
    return `版本号 ${next} 不合法：只接受 x.y.z、x.y.z-alpha.n 或 x.y.z-beta.n。`
  }
  const from = parseVersion(current)
  if (!from) return `当前版本号 ${current} 不合法。`
  if (compareVersions(to, from) <= 0) {
    return `新版本 ${next} 必须比当前的 ${current} 新（同一版本只能按 alpha → beta → 正式版前进）。`
  }
  const channel = channelOf(to)
  if (channel !== 'latest' && branch !== 'main') {
    return `${channel} 版本只能从 main 发布，当前分支是 ${branch}。`
  }
  if (channel === 'latest' && branch !== 'main' && !/^release\/\d+\.\d+$/.test(branch)) {
    return `正式版只能从 main 或 release/x.y 发布，当前分支是 ${branch}。`
  }
  if (branch.startsWith('release/')) {
    const line = branch.slice('release/'.length)
    if (`${to.major}.${to.minor}` !== line) {
      return `${branch} 只能发布 ${line}.x 的版本，不能发布 ${next}。`
    }
  }
  return null
}

/**
 * The dist-tag to publish a version under, given the version `latest` points
 * to now. A release older than the current `latest` (a patch on a maintenance
 * line) gets `latest-x.y` so it does not take `latest` away.
 */
export function distTagFor(version: Version, currentLatest: Version | null): string {
  const channel = channelOf(version)
  if (channel !== 'latest' || !currentLatest || currentLatest.pre) return channel
  return compareVersions(version, currentLatest) < 0
    ? `latest-${version.major}.${version.minor}`
    : 'latest'
}
