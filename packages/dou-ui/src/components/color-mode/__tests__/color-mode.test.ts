import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DouColorModeButton, DouColorModeSelect, DouColorModeSwitch } from '../../../index'
import { colorModeScript, resetColorMode, useColorMode } from '../use-color-mode'

let prefersDark = false
const listeners = new Set<() => void>()

beforeEach(() => {
  prefersDark = false
  listeners.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('dark') && prefersDark
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
  localStorage.clear()
  resetColorMode()
  delete document.documentElement.dataset.douTheme
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('useColorMode', () => {
  it('follows the system until a mode is picked, and remembers it', async () => {
    prefersDark = true
    const { mode, resolved, isDark } = useColorMode()
    expect(mode.value).toBe('system')
    expect(resolved.value).toBe('dark')
    expect(document.documentElement.dataset.douTheme).toBe('dark')

    prefersDark = false
    for (const listener of listeners) listener()
    await nextTick()
    expect(document.documentElement.dataset.douTheme).toBe('light')

    isDark.value = true
    await nextTick()
    expect(mode.value).toBe('dark')
    expect(localStorage.getItem('dou-color-mode')).toBe('dark')
    expect(document.documentElement.dataset.douTheme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('reads the remembered mode and shares one state', () => {
    localStorage.setItem('dou-color-mode', 'dark')
    const first = useColorMode()
    const second = useColorMode({ storageKey: 'ignored' })
    expect(first.mode.value).toBe('dark')
    expect(second).toBe(first)
  })

  it('takes a change made in another tab', async () => {
    const { mode } = useColorMode()
    window.dispatchEvent(new StorageEvent('storage', { key: 'dou-color-mode', newValue: 'dark' }))
    await nextTick()
    expect(mode.value).toBe('dark')
  })

  it('writes a head script that applies the remembered mode', () => {
    localStorage.setItem('theme', 'dark')
    new Function(colorModeScript({ storageKey: 'theme' }))()
    expect(document.documentElement.dataset.douTheme).toBe('dark')
  })
})

describe('color mode components', () => {
  it('toggles between light and dark from the button', async () => {
    const wrapper = mount(DouColorModeButton)
    await nextTick()
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('切换到暗色模式')
    await button.trigger('click')
    expect(useColorMode().mode.value).toBe('dark')
    expect(button.attributes('aria-label')).toBe('切换到亮色模式')
  })

  it('switches to dark and back', async () => {
    const wrapper = mount(DouColorModeSwitch)
    await nextTick()
    const track = wrapper.get('[role="switch"]')
    expect(track.attributes('aria-label')).toBe('暗色')
    expect(track.attributes('aria-checked')).toBe('false')
    await track.trigger('click')
    expect(useColorMode().resolved.value).toBe('dark')
    expect(track.attributes('aria-checked')).toBe('true')
  })

  it('picks light, dark or system from the select', async () => {
    const wrapper = mount(DouColorModeSelect, { attachTo: document.body })
    await nextTick()
    expect(wrapper.text()).toContain('跟随系统')
    await wrapper.get('.dou-select').trigger('mousedown')
    const dark = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) =>
      option.textContent?.includes('暗色'),
    )!
    dark.click()
    await nextTick()
    expect(useColorMode().mode.value).toBe('dark')
    expect(wrapper.text()).toContain('暗色')
    wrapper.unmount()
  })
})
