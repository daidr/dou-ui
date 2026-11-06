/** Files a release pull request may change: versions, the lockfile and the changelog. */
const allowed = [
  /^packages\/[^/]+\/package\.json$/,
  /^bun\.lock$/,
  /^CHANGELOG\.md$/,
  /^\.changes\//,
]

/**
 * Why a release pull request's changes are not a plain release, or an empty
 * list. CI skips its checks, so anything else would ship unchecked.
 */
export function checkReleaseChanges(changed: string[], baseIsAncestor: boolean): string[] {
  const problems: string[] = []
  const extra = changed.filter((path) => !allowed.some((pattern) => pattern.test(path)))
  if (extra.length) {
    problems.push(
      `发版 PR 只能改版本号、bun.lock、CHANGELOG.md 和 .changes/，这里还改了：${extra.join('、')}。CI 不检查发版 PR，代码改动请走普通 PR。`,
    )
  }
  if (!baseIsAncestor) {
    problems.push(
      '发版 PR 没有基于当前的 main：关掉它重新准备（自动维护的预览版 PR 会在 main 更新时自己重新生成）。',
    )
  }
  return problems
}
