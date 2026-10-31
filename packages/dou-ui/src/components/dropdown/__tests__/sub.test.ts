import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouDropdown, DouDropdownButton, DouDropdownItem, DouDropdownSub } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
const menus = () => [...document.querySelectorAll<HTMLElement>('[role="menu"]')]
const tick = async () => {
  await nextTick()
  await nextTick()
}

function withSub() {
  const wrapper = mount(DouDropdown, {
    props: {
      open: false,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
    },
    slots: {
      default: () => h('button', { id: 'trigger' }, '更多'),
      menu: () => [
        h(DouDropdownItem, { value: 'edit' }, () => '编辑'),
        h(DouDropdownSub, { title: '导出为' }, () => [
          h(DouDropdownItem, { value: 'pdf' }, () => 'PDF'),
          h(DouDropdownItem, { value: 'png' }, () => 'PNG'),
        ]),
      ],
    },
    attachTo: document.body,
  })
  return wrapper
}

describe('DouDropdownSub', () => {
  it('opens with ArrowRight and closes with ArrowLeft, focus following', async () => {
    const wrapper = withSub()
    await wrapper.get('#trigger').trigger('click')
    const sub = document.querySelector<HTMLElement>('[role="menuitem"][aria-haspopup]')!
    expect(sub.getAttribute('aria-expanded')).toBe('false')
    sub.focus()
    key(sub, 'ArrowRight')
    await tick()
    expect(sub.getAttribute('aria-expanded')).toBe('true')
    const panel = menus()[1]!
    expect(sub.getAttribute('aria-controls')).toBe(panel.id)
    expect(document.activeElement?.textContent).toBe('PDF')
    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement?.textContent).toBe('PNG')
    key(document.activeElement!, 'ArrowLeft')
    await tick()
    expect(sub.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(sub)
  })

  it('selects through the root menu and closes everything', async () => {
    const wrapper = withSub()
    await wrapper.get('#trigger').trigger('click')
    const sub = document.querySelector<HTMLElement>('[role="menuitem"][aria-haspopup]')!
    sub.focus()
    key(sub, 'Enter')
    await tick()
    key(document.activeElement!, 'Enter')
    await tick()
    expect(wrapper.emitted('select')).toEqual([['pdf']])
    expect(wrapper.props('open')).toBe(false)
    expect(sub.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement?.id).toBe('trigger')
  })

  it('opens on hover after a short rest and stays open over its panel', async () => {
    vi.useFakeTimers()
    const wrapper = withSub()
    await wrapper.get('#trigger').trigger('click')
    const sub = document.querySelector<HTMLElement>('[role="menuitem"][aria-haspopup]')!
    sub.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    vi.advanceTimersByTime(120)
    await tick()
    expect(sub.getAttribute('aria-expanded')).toBe('true')
    sub.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    menus()[1]!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    vi.advanceTimersByTime(300)
    await tick()
    expect(sub.getAttribute('aria-expanded')).toBe('true')
    menus()[1]!.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    vi.advanceTimersByTime(300)
    await tick()
    expect(sub.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('DouDropdownSub on touch', () => {
  it('opens on a tap and stays open when the finger lifts', async () => {
    vi.useFakeTimers()
    const wrapper = withSub()
    await wrapper.get('#trigger').trigger('click')
    const sub = document.querySelector<HTMLElement>('[role="menuitem"][aria-haspopup]')!
    sub.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }))
    sub.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }))
    sub.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'touch' }))
    vi.advanceTimersByTime(300)
    await tick()
    expect(sub.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('DouDropdownButton', () => {
  it('splits a main action from a menu of more', async () => {
    const wrapper = mount(DouDropdownButton, {
      props: { variant: 'solid', tone: 'primary' },
      slots: {
        default: () => '保存',
        menu: () => [h(DouDropdownItem, { value: 'draft' }, () => '存为草稿')],
      },
      attachTo: document.body,
    })
    const [main, arrow] = wrapper.findAll('button')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-field-group', 'dou-dropdown-button']),
    )
    await main!.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(arrow!.attributes('aria-label')).toBe('更多操作')
    expect(arrow!.attributes('aria-haspopup')).toBe('menu')
    await arrow!.trigger('click')
    document.querySelector<HTMLElement>('[role="menuitem"]')!.click()
    await tick()
    expect(wrapper.emitted('select')).toEqual([['draft']])
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
