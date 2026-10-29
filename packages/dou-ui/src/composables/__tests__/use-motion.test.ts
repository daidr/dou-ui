import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { ComputedRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DouCollapseTransition,
  DouConfigProvider,
  getMotionDuration,
  setMotionMode,
  useReducedMotion,
} from '../../index'

const root = document.documentElement

afterEach(() => {
  root.removeAttribute('data-dou-motion')
  root.style.removeProperty('--dou-motion-duration-normal')
  vi.unstubAllGlobals()
})

function probe() {
  let reduced!: ComputedRef<boolean>
  const Probe = defineComponent({
    setup() {
      reduced = useReducedMotion()
      return () => null
    },
  })
  return { Probe, read: () => reduced.value }
}

describe('motion mode', () => {
  it('sets and clears the page attribute', () => {
    setMotionMode('reduce')
    expect(root.dataset.douMotion).toBe('reduce')
    setMotionMode('auto')
    expect(root.hasAttribute('data-dou-motion')).toBe(false)
  })

  it('is applied by ConfigProvider while it is mounted', async () => {
    root.setAttribute('data-dou-motion', 'reduce')
    const motion = ref<'none' | 'auto'>('none')
    const wrapper = mount(() => h(DouConfigProvider, { motion: motion.value }, () => 'x'))
    expect(root.dataset.douMotion).toBe('none')
    motion.value = 'auto'
    await nextTick()
    expect(root.hasAttribute('data-dou-motion')).toBe(false)
    wrapper.unmount()
    // what the page had before comes back
    expect(root.dataset.douMotion).toBe('reduce')
  })

  it('leaves the page alone when ConfigProvider sets no motion', () => {
    root.setAttribute('data-dou-motion', 'none')
    mount(DouConfigProvider, { slots: { default: () => 'x' } }).unmount()
    expect(root.dataset.douMotion).toBe('none')
  })
})

describe('useReducedMotion', () => {
  it('follows the system setting by default', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      addEventListener() {},
      removeEventListener() {},
    }))
    const { Probe, read } = probe()
    mount(Probe)
    expect(read()).toBe(true)
  })

  it('reads the page attribute and the configured mode', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }))
    const { Probe, read } = probe()
    mount(Probe)
    expect(read()).toBe(false)

    root.setAttribute('data-dou-motion', 'none')
    const page = probe()
    mount(page.Probe)
    expect(page.read()).toBe(true)
    root.removeAttribute('data-dou-motion')

    const configured = probe()
    mount(DouConfigProvider, {
      props: { motion: 'reduce' },
      slots: { default: () => h(configured.Probe) },
    })
    expect(configured.read()).toBe(true)
  })
})

describe('getMotionDuration', () => {
  it('reads a duration token in milliseconds', () => {
    root.style.setProperty('--dou-motion-duration-normal', '220ms')
    expect(getMotionDuration('normal')).toBe(220)
    root.style.setProperty('--dou-motion-duration-normal', '0.3s')
    expect(getMotionDuration('normal')).toBe(300)
    expect(getMotionDuration('slow')).toBe(0)
  })
})

describe('DouCollapseTransition', () => {
  it('renders its content and registers by name', () => {
    const wrapper = mount(() => h(DouCollapseTransition, () => h('div', { class: 'body' }, 'x')))
    expect(wrapper.find('.body').exists()).toBe(true)
    expect(DouCollapseTransition.name).toBe('DouCollapseTransition')
  })
})
