import { mount } from '@vue/test-utils'
import { globSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
// 只引入用到的组件，不经过总入口：和按需引入时打包器留下的模块一样
import { DouChatMessage } from '../../components/chat-message'
import { DouConfigProvider } from '../../components/config-provider'

const here = dirname(fileURLToPath(import.meta.url))
const packages = resolve(here, '../../../..')

describe('ConfigProvider defaults of nested components', () => {
  it('reach a component another component renders, when only the outer one is imported', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { defaults: { DouStreamText: { as: 'p' } } },
      slots: {
        default: () => h(DouChatMessage, { parts: [{ type: 'text', text: '周六适合骑车。' }] }),
      },
    })
    expect(wrapper.get('.dou-chat-message__text').element.tagName).toBe('P')
  })
})

/**
 * 默认值由 `withInstall` 接上，而它写在组件的入口模块里。打包器只留下用到的模块，
 * 所以组件 A 直接引入组件 B 的 `.vue` 时，单独用 A 的项目里 B 的入口可能根本不在包里，
 * `defaults.DouB` 就读不到。这里检查：从任何入口能走到的每个包装过的 `.vue`，
 * 包装它的模块也一定能走到。
 */
describe('module graph', () => {
  const files = globSync('*/src/**/*.{ts,vue}', { cwd: packages })
    .filter((file) => !/__tests__|\.(test|spec|d)\.ts$/.test(file))
    .map((file) => resolve(packages, file))
  const known = new Set(files)
  const sources = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]))

  const resolveSpec = (from: string, spec: string) => {
    const base = resolve(dirname(from), spec)
    return [base, `${base}.ts`, `${base}/index.ts`].find((path) => known.has(path))
  }

  // 运行时的相对引入（不含 `import type` / `export type`）
  const deps = new Map<string, string[]>()
  // 包装过的 `.vue` → 包装它的模块
  const wrapper = new Map<string, string>()
  for (const [file, source] of sources) {
    const out: string[] = []
    for (const [, type, spec] of source.matchAll(
      /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[\w{}\s,*$]+?\s+from\s+)?'(\.[^']*)'/g,
    )) {
      const target = !type && resolveSpec(file, spec!)
      if (target) out.push(target)
    }
    deps.set(file, out)
    const locals = new Map<string, string>()
    for (const [, name, spec] of source.matchAll(/import\s+(\w+)\s+from\s+'(\.[^']*\.vue)'/g)) {
      const target = resolveSpec(file, spec!)
      if (target) locals.set(name!, target)
    }
    for (const [, name] of source.matchAll(/withInstall(?:<[^>]*>)?\(\s*(\w+)/g)) {
      const target = locals.get(name!)
      if (target) wrapper.set(target, file)
    }
  }

  it('finds the wrapped components', () => {
    expect(wrapper.size).toBeGreaterThan(150)
  })

  it('reaches the wrapping module of every wrapped component it reaches', () => {
    const entries = new Set([
      ...files.filter((file) => file.endsWith('/index.ts')),
      ...wrapper.values(),
    ])
    const problems = new Set<string>()
    for (const entry of entries) {
      const seen = new Set<string>()
      const stack = [entry]
      while (stack.length) {
        const file = stack.pop()!
        if (seen.has(file)) continue
        seen.add(file)
        stack.push(...deps.get(file)!)
      }
      for (const file of seen) {
        for (const dep of deps.get(file)!) {
          const owner = wrapper.get(dep)
          if (owner && owner !== file && !seen.has(owner)) {
            problems.add(
              `${relative(packages, file)} 引入了 ${relative(packages, dep)}，` +
                `应改为引入 ${relative(packages, owner)} 导出的组件`,
            )
          }
        }
      }
    }
    expect([...problems]).toEqual([])
  })
})
