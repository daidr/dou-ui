import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouContextMenu, DouDropdownItem } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const menu = () => document.querySelector<HTMLElement>('.dou-context-menu')
const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))

function make(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouContextMenu, {
    props: {
      open: false,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      ...props,
    },
    slots: {
      default: () => h('div', { id: 'area' }, '文件列表'),
      menu: () => [
        h(DouDropdownItem, { value: 'open' }, () => '打开'),
        h(DouDropdownItem, { value: 'rename' }, () => '重命名'),
        h(DouDropdownItem, { value: 'delete', tone: 'danger', divided: true }, () => '删除'),
      ],
    },
    attachTo: document.body,
  })
  return wrapper
}

const rightClick = (target: Element, x = 120, y = 80) => {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 2,
  })
  target.dispatchEvent(event)
  return event
}

describe('DouContextMenu', () => {
  it('opens a menu at the pointer instead of the browser menu', async () => {
    const wrapper = make()
    const event = rightClick(wrapper.get('#area').element)
    expect(event.defaultPrevented).toBe(true)
    await nextTick()
    await nextTick()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([true])
    const panel = menu()!
    expect(panel.getAttribute('role')).toBe('menu')
    expect(panel.classList).toContain('dou-dropdown')
    expect(panel.style.position).toBe('fixed')
    expect(document.activeElement).toBe(panel)
    wrapper.unmount()
  })

  it('moves through items with the keyboard and emits the chosen value', async () => {
    const wrapper = make()
    rightClick(wrapper.get('#area').element)
    await nextTick()
    await nextTick()
    key(menu()!, 'ArrowDown')
    expect(document.activeElement?.textContent).toBe('打开')
    key(document.activeElement!, 'ArrowDown')
    key(document.activeElement!, 'Enter')
    await nextTick()
    expect(wrapper.emitted('select')?.[0]).toEqual(['rename'])
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('closes on Escape and on a press outside', async () => {
    const wrapper = make()
    rightClick(wrapper.get('#area').element)
    await nextTick()
    key(document.body, 'Escape')
    await nextTick()
    expect(wrapper.props('open')).toBe(false)

    rightClick(wrapper.get('#area').element)
    await nextTick()
    expect(wrapper.props('open')).toBe(true)
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })

  it('leaves the browser menu alone when disabled', async () => {
    const wrapper = make({ disabled: true })
    const event = rightClick(wrapper.get('#area').element)
    expect(event.defaultPrevented).toBe(false)
    await nextTick()
    expect(menu()).toBeNull()
    wrapper.unmount()
  })

  it('opens from script at a point', async () => {
    const wrapper = make()
    ;(wrapper.vm as unknown as { open: (x: number, y: number) => void }).open(40, 60)
    await nextTick()
    await nextTick()
    expect(menu()).not.toBeNull()
    expect(wrapper.props('open')).toBe(true)
    wrapper.unmount()
  })
})
