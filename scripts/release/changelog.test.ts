// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  checkPackages,
  formatFragment,
  parseFragment,
  releaseChangelog,
  renderChanges,
  type Fragment,
  type RenderContext,
} from './changelog'

const ctx: RenderContext = {
  repoUrl: 'https://github.com/daidr/dou-ui',
  packageNames: { 'dou-ui': 'dou-ui', sheet: '@dou-ui/sheet', editor: '@dou-ui/editor' },
}

const fragment = (over: Partial<Fragment>): Fragment => ({
  name: 'x',
  type: '新增',
  packages: [],
  body: '改动',
  ...over,
})

const intro = '# 更新日志\n\n说明文字。\n'

describe('parseFragment', () => {
  it('reads the type, packages and body', () => {
    const parsed = parseFragment(
      'sheet-comments',
      '---\ntype: 新增\npackages: [sheet, editor]\n---\n\n支持评论。\n',
    )
    expect(parsed).toEqual({
      name: 'sheet-comments',
      type: '新增',
      packages: ['sheet', 'editor'],
      body: '支持评论。',
    })
    expect(
      parseFragment('a', formatFragment({ ...parsed, pr: 12, version: '0.1.0-alpha.0' })),
    ).toEqual({
      ...parsed,
      name: 'a',
      pr: 12,
      version: '0.1.0-alpha.0',
    })
  })

  it('names what is wrong', () => {
    expect(() => parseFragment('a', '没有元数据')).toThrow('a.md 缺少')
    expect(() => parseFragment('a', '---\ntype: 杂项\n---\n正文')).toThrow('type 必须是')
    expect(() => parseFragment('a', '---\ntype: 修复\n---\n')).toThrow('没有正文')
  })

  it('flags unknown packages', () => {
    expect(checkPackages(fragment({ packages: ['shet'] }), ctx)[0]).toMatch('包 shet 不存在')
  })
})

describe('renderChanges', () => {
  it('groups by type in a fixed order, with package names and pull request links', () => {
    const text = renderChanges(
      [
        fragment({
          name: 'b',
          type: '修复',
          packages: ['sheet'],
          body: '复制不再丢格式。',
          pr: 20,
        }),
        fragment({
          name: 'a',
          type: '不兼容',
          body: '`foo` 改名为 `bar`。\n迁移：全局替换。',
          pr: 18,
        }),
        fragment({ name: 'c', type: '说明', body: '这一版专注性能。' }),
        fragment({ name: 'd', type: '修复', packages: ['sheet', 'editor'], body: '另一个修复。' }),
      ],
      ctx,
    )
    expect(text).toBe(
      [
        '这一版专注性能。',
        '',
        '### 不兼容',
        '',
        '- `foo` 改名为 `bar`。',
        '  迁移：全局替换。 ([#18](https://github.com/daidr/dou-ui/pull/18))',
        '',
        '### 修复',
        '',
        '- **@dou-ui/sheet**：复制不再丢格式。 ([#20](https://github.com/daidr/dou-ui/pull/20))',
        '- **@dou-ui/sheet、@dou-ui/editor**：另一个修复。',
      ].join('\n'),
    )
  })
})

describe('releaseChangelog', () => {
  it('puts a prerelease section above older versions, listing pending fragments only', () => {
    const { changelog, notes } = releaseChangelog({
      changelog: `${intro}\n## 0.1.0 · 2026-01-01\n\n旧内容\n`,
      version: '0.2.0-alpha.0',
      date: '2026-02-01',
      pending: [fragment({ body: '新功能' })],
      prereleased: [fragment({ name: 'old', body: '已经在 alpha 里' })],
      ctx,
    })
    expect(notes).toBe('### 新增\n\n- 新功能')
    expect(changelog).toBe(
      `${intro}\n## 0.2.0-alpha.0 · 2026-02-01\n\n### 新增\n\n- 新功能\n\n## 0.1.0 · 2026-01-01\n\n旧内容\n`,
    )
  })

  it('gathers a release from its prereleases and folds their sections', () => {
    const before = [
      intro,
      '## 0.2.0-beta.0 · 2026-02-10\n\n### 修复\n\n- 修好了\n',
      '## 0.2.0-alpha.0 · 2026-02-01\n\n### 新增\n\n- 新功能\n',
      '## 0.1.0 · 2026-01-01\n\n旧内容\n',
    ].join('\n')
    const { changelog, notes } = releaseChangelog({
      changelog: before,
      version: '0.2.0',
      date: '2026-03-01',
      pending: [fragment({ name: 'late', type: '改进', body: '最后的改进' })],
      prereleased: [
        fragment({ name: 'feat', body: '新功能', version: '0.2.0-alpha.0' }),
        fragment({ name: 'fix', type: '修复', body: '修好了', version: '0.2.0-beta.0' }),
      ],
      ctx,
    })
    expect(notes).toContain(
      '### 新增\n\n- 新功能\n\n### 改进\n\n- 最后的改进\n\n### 修复\n\n- 修好了',
    )
    expect(notes).toContain('<summary>预发布版本（0.2.0-alpha.0 至 0.2.0-beta.0）</summary>')
    expect(notes).toContain('### 0.2.0-beta.0 · 2026-02-10\n\n#### 修复')
    // the prerelease sections live only inside the release now
    expect(changelog.match(/^## /gm)).toHaveLength(2)
    expect(changelog.indexOf('## 0.2.0 · 2026-03-01')).toBeLessThan(changelog.indexOf('## 0.1.0'))
  })

  it('keeps versions newest first when a maintenance release comes later', () => {
    const { changelog } = releaseChangelog({
      changelog: `${intro}\n## 0.3.0 · 2026-03-01\n\n新\n\n## 0.2.0 · 2026-02-01\n\n旧\n`,
      version: '0.2.1',
      date: '2026-03-05',
      pending: [fragment({ type: '修复', body: '补丁' })],
      prereleased: [],
      ctx,
    })
    const order = [...changelog.matchAll(/^## (\S+)/gm)].map((match) => match[1])
    expect(order).toEqual(['0.3.0', '0.2.1', '0.2.0'])
  })

  it('says so when nothing was recorded', () => {
    const { notes } = releaseChangelog({
      changelog: intro,
      version: '0.1.1',
      date: '2026-01-02',
      pending: [],
      prereleased: [],
      ctx,
    })
    expect(notes).toBe('没有记录的改动。')
  })
})
