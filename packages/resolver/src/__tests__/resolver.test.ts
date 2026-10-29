import { existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as DouUI from '../../../dou-ui/src/index'
import * as Icons from '../../../icons/src/index'
import { DouUIApiResolver, DouUIResolver, componentDirs } from '../index'

const [components, directives] = DouUIResolver()
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
    expect(resolveApi('ref')).toBeUndefined()
    for (const name of ['toast', 'dialog', 'useDialog', 'vLoading']) {
      expect(name in DouUI).toBe(true)
    }
  })
})
