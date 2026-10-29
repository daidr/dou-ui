import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { DouKbd } from '../../../index'

describe('DouKbd', () => {
  it('renders a kbd element', () => {
    const wrapper = mount(DouKbd, { slots: { default: '⌘' } })
    expect(wrapper.element.tagName).toBe('KBD')
    expect(wrapper.text()).toBe('⌘')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-kbd', 'dou-kbd--md']))
  })

  it('applies the size', () => {
    const wrapper = mount(DouKbd, { props: { size: 'sm' }, slots: { default: 'K' } })
    expect(wrapper.classes()).toContain('dou-kbd--sm')
  })

  it('shows a hotkey with the platform key names', async () => {
    const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    const wrapper = mount(DouKbd, { props: { keys: 'mod+shift+p' } })
    await nextTick()
    expect(wrapper.findAll('.dou-kbd__step .dou-kbd').map((key) => key.text())).toEqual(['⇧', '⌘', 'P'])
    platform.mockReturnValue('Win32')
    const other = mount(DouKbd, { props: { keys: 'g i' } })
    await nextTick()
    expect(other.findAll('.dou-kbd__step')).toHaveLength(2)
    platform.mockRestore()
  })
})
