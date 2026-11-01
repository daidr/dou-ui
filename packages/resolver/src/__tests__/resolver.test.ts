import { existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import * as DouUI from '../../../dou-ui/src/index'
import * as Icons from '../../../icons/src/index'
import {
  DouUIApiResolver,
  DouUIResolver,
  componentDirs,
  functionDirs,
  packageComponents,
} from '../index'

const [components, directives] = DouUIResolver({ icons: false })
const resolve = (name: string) => components!.resolve(name)

describe('DouUIResolver', () => {
  it('resolves a component with its style entry', () => {
    expect(resolve('DouButton')).toEqual({
      name: 'DouButton',
      from: 'dou-ui',
      sideEffects: 'dou-ui/components/button/style',
    })
    // Components that live with another one share its style entry.
    expect(resolve('DouCalendar')?.sideEffects).toBe('dou-ui/components/date-picker/style')
    expect(resolve('DouImagePreview')?.sideEffects).toBe('dou-ui/components/image/style')
  })

  it('knows every component dou-ui exports', () => {
    const exported = Object.keys(DouUI).filter(
      (key) => /^Dou[A-Z]/.test(key) && key !== 'DouUI' && typeof (DouUI as any)[key] === 'object',
    )
    expect(Object.keys(componentDirs).toSorted()).toEqual(exported.toSorted())
    for (const dir of new Set(Object.values(componentDirs))) {
      const index = resolvePath(
        import.meta.dirname,
        `../../../dou-ui/src/components/${dir}/index.ts`,
      )
      expect(existsSync(index)).toBe(true)
    }
  })

  it('leaves other names alone', () => {
    expect(resolve('RouterLink')).toBeUndefined()
    expect(resolve('DouNothing')).toBeUndefined()
    expect(resolve('SearchIcon')).toBeUndefined()
    expect(resolve('constructor')).toBeUndefined()
    expect(resolve('toString')).toBeUndefined()
  })

  it('resolves the components of the packages built on dou-ui', () => {
    expect(resolve('DouChartLine')).toEqual({
      name: 'DouChartLine',
      from: '@dou-ui/chart',
      sideEffects: '@dou-ui/chart/style',
    })
    expect(resolve('DouEditor')?.from).toBe('@dou-ui/editor')
    // A component with a lighter entry of its own is imported from there.
    expect(resolve('DouFormRenderer')).toEqual({
      name: 'DouFormRenderer',
      from: '@dou-ui/form-builder/renderer',
      sideEffects: '@dou-ui/form-builder/renderer/style',
    })
    expect(resolve('DouFormBuilder')?.from).toBe('@dou-ui/form-builder')
    expect(resolve('DouScheduler')).toEqual({
      name: 'DouScheduler',
      from: '@dou-ui/gantt/scheduler',
      sideEffects: '@dou-ui/gantt/scheduler/style',
    })
    const [plain] = DouUIResolver({ importStyle: false, icons: false })
    expect(plain!.resolve('DouSheet')).toEqual({ name: 'DouSheet', from: '@dou-ui/sheet' })
  })

  it('knows every component the packages built on dou-ui export', async () => {
    for (const [name, { package: pkg, from, style }] of Object.entries(packageComponents)) {
      expect(from.startsWith(pkg)).toBe(true)
      expect([`${pkg}/style`, `${from}/style`]).toContain(style)
      const entry = await import(/* @vite-ignore */ from)
      expect([name, typeof entry[name]]).toEqual([name, 'object'])
    }
    // A sample from each package.
    for (const name of [
      'DouChart',
      'DouCodeEditor',
      'DouDashboard',
      'DouEditor',
      'DouFlowEditor',
      'DouFormBuilder',
      'DouGantt',
      'DouPivot',
      'DouSheet',
    ]) {
      expect(packageComponents).toHaveProperty(name)
    }
  })

  it('resolves icons when @dou-ui/icons can be found from the project', () => {
    const cwd = vi.spyOn(process, 'cwd')
    try {
      // `dou-ui` depends on the icons, so they can be found from there.
      cwd.mockReturnValue(resolvePath(import.meta.dirname, '../../../dou-ui'))
      expect(DouUIResolver()[0]!.resolve('SearchIcon')?.from).toBe('@dou-ui/icons')
      cwd.mockReturnValue(resolvePath(import.meta.dirname, '../../../theme'))
      expect(DouUIResolver()[0]!.resolve('SearchIcon')).toBeUndefined()
      // `root` points at the project when Vite runs elsewhere.
      const root = resolvePath(import.meta.dirname, '../../../dou-ui')
      expect(DouUIResolver({ root })[0]!.resolve('SearchIcon')?.from).toBe('@dou-ui/icons')
    } finally {
      cwd.mockRestore()
    }
  })

  it('can skip styles, exclude names and resolve icons', () => {
    const [plain] = DouUIResolver({ importStyle: false, exclude: /^DouTable$/, icons: true })
    expect(plain!.resolve('DouSelect')).toEqual({ name: 'DouSelect', from: 'dou-ui' })
    expect(plain!.resolve('DouTable')).toBeUndefined()
    expect(plain!.resolve('SearchIcon')).toEqual({ name: 'SearchIcon', from: '@dou-ui/icons' })
    const exportedIcons = Object.keys(Icons).filter(
      (key) => key.endsWith('Icon') && key !== 'createIcon',
    )
    for (const name of exportedIcons) expect(plain!.resolve(name)?.from).toBe('@dou-ui/icons')
  })

  it('resolves v-loading', () => {
    expect(directives!.type).toBe('directive')
    expect(directives!.resolve('Loading')).toEqual({
      name: 'vLoading',
      from: 'dou-ui',
      sideEffects: 'dou-ui/components/loading/style',
    })
    expect(directives!.resolve('Focus')).toBeUndefined()
    expect(DouUIResolver({ directives: false })).toHaveLength(1)
  })
})

describe('DouUIApiResolver', () => {
  it('resolves the functions with the styles of what they show', () => {
    const resolveApi = DouUIApiResolver()
    expect(resolveApi('toast')).toEqual({
      name: 'toast',
      from: 'dou-ui',
      sideEffects: 'dou-ui/components/toast/style',
    })
    expect(resolveApi('dialog')?.sideEffects).toBe('dou-ui/components/dialog/style')
    expect(resolveApi('useDialog')?.name).toBe('useDialog')
    expect(resolveApi('useColorMode')).toEqual({ name: 'useColorMode', from: 'dou-ui' })
    expect(resolveApi('ref')).toBeUndefined()
    expect(resolveApi('constructor')).toBeUndefined()
    for (const name of Object.keys(functionDirs)) expect(name in DouUI).toBe(true)
  })
})
