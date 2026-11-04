import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

/**
 * Vue skips a listener attached in the same millisecond as the first Vue
 * listener an event reached, so tests that need two of them wait a little.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 5))

const touch = (type: string, target: EventTarget, x = 60, y = 40) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      isPrimary: true,
      clientX: x,
      clientY: y,
    }),
  )

describe('DouContextMenu', () => {
  it('opens below a box it is given, or above it when there is no room', async () => {
    // a 800 × 600 viewport and a 200px tall menu
    const html = document.documentElement
    vi.spyOn(html, 'clientWidth', 'get').mockReturnValue(800)
    vi.spyOn(html, 'clientHeight', 'get').mockReturnValue(600)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(160)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200)
    const wrapper = make()
    const button = { width: 40, height: 30 }
    const placed = async (y: number) => {
      ;(wrapper.vm as unknown as { open: (...args: unknown[]) => void }).open(100, y, button)
      await nextTick()
      await nextTick()
      const top = parseFloat(menu()!.style.top)
      return { top, bottom: top + 200 }
    }
    const below = await placed(100)
    expect(below.top).toBeGreaterThanOrEqual(130)
    const above = await placed(500)
    expect(above.bottom).toBeLessThanOrEqual(500)
    expect(above.top).toBeGreaterThanOrEqual(0)
    wrapper.unmount()
    vi.restoreAllMocks()
  })

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

  describe('long press on touch screens', () => {
    afterEach(() => vi.useRealTimers())

    it('opens at the finger and sends contextmenu from the pressed element', async () => {
      vi.useFakeTimers()
      const wrapper = make()
      const area = document.getElementById('area')!
      const seen: MouseEvent[] = []
      area.addEventListener('contextmenu', (event) => seen.push(event))
      touch('pointerdown', area)
      expect(area.style.getPropertyValue('user-select')).toBe('none')
      vi.advanceTimersByTime(499)
      expect(wrapper.emitted('update:open')).toBeUndefined()
      vi.advanceTimersByTime(1)
      await nextTick()
      expect(wrapper.emitted('update:open')?.at(-1)).toEqual([true])
      expect(seen).toHaveLength(1)
      expect([seen[0]!.clientX, seen[0]!.clientY]).toEqual([60, 40])
      // lifting the finger swallows the click it may produce
      touch('pointerup', window)
      const click = new MouseEvent('click', { bubbles: true, cancelable: true })
      area.dispatchEvent(click)
      expect(click.defaultPrevented).toBe(true)
      // and gives the element its style back
      expect(area.getAttribute('style')).toBeNull()
      wrapper.unmount()
    })

    it('scrolls instead when the finger moves first', async () => {
      vi.useFakeTimers()
      const wrapper = make()
      const area = document.getElementById('area')!
      touch('pointerdown', area)
      touch('pointermove', window, 60, 60)
      vi.advanceTimersByTime(600)
      await nextTick()
      expect(wrapper.emitted('update:open')).toBeUndefined()
    })

    it('a short tap does nothing', async () => {
      vi.useFakeTimers()
      const wrapper = make()
      const area = document.getElementById('area')!
      touch('pointerdown', area)
      vi.advanceTimersByTime(200)
      touch('pointerup', window)
      vi.advanceTimersByTime(600)
      await nextTick()
      expect(wrapper.emitted('update:open')).toBeUndefined()
      const click = new MouseEvent('click', { bubbles: true, cancelable: true })
      area.dispatchEvent(click)
      expect(click.defaultPrevented).toBe(false)
    })

    it('leaves the mouse to the browser', async () => {
      vi.useFakeTimers()
      const wrapper = make()
      const area = document.getElementById('area')!
      area.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', isPrimary: true }),
      )
      vi.advanceTimersByTime(600)
      await nextTick()
      expect(wrapper.emitted('update:open')).toBeUndefined()
    })
  })

  it('renders items given as data and runs the chosen one', async () => {
    const copy = vi.fn<() => void>()
    const onSelect = vi.fn<(value: unknown) => void>()
    const wrapper = mount(DouContextMenu, {
      props: {
        items: [
          { key: 'copy', label: '复制', shortcut: 'mod+c', run: copy },
          {
            key: 'delete',
            label: '删除',
            tone: 'danger',
            divided: true,
            disabled: true,
            run: () => {},
          },
        ],
        onSelect,
      },
      slots: { default: () => h('div', { id: 'area' }, '文件列表') },
      attachTo: document.body,
    })
    rightClick(wrapper.get('#area').element)
    await nextTick()
    const items = [...menu()!.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      expect.stringContaining('复制'),
      '删除',
    ])
    expect(items[1]!.getAttribute('aria-disabled')).toBe('true')
    items[0]!.click()
    await nextTick()
    expect(copy).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('copy')
    wrapper.unmount()
  })

  it('reads a menu whose items all have checked as one choice', async () => {
    const wrapper = mount(DouContextMenu, {
      props: {
        items: [
          { key: 'a', label: '按名称', checked: true, run: () => {} },
          { key: 'b', label: '按时间', checked: false, run: () => {} },
        ],
      },
      slots: { default: () => h('div', { id: 'area' }, '文件列表') },
      attachTo: document.body,
    })
    rightClick(wrapper.get('#area').element)
    await nextTick()
    const radios = menu()!.querySelectorAll('[role="menuitemradio"]')
    expect([...radios].map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    wrapper.unmount()
  })

  it('clears the target at the start of every right click, before the events inside', async () => {
    const seen: unknown[] = []
    let current: unknown = 'stale'
    const wrapper = mount(DouContextMenu, {
      props: {
        target: current,
        'onUpdate:target': (value: unknown) => {
          current = value
          seen.push(value)
        },
      },
      slots: {
        default: () =>
          h('ul', { id: 'list' }, [
            h('li', { id: 'item', onContextmenu: () => (current = 'item') }, '设计稿.fig'),
          ]),
        menu: () => h(DouDropdownItem, { value: 'open' }, () => '打开'),
      },
      attachTo: document.body,
    })
    await settle()
    rightClick(wrapper.get('#item').element)
    expect(seen).toEqual([undefined])
    expect(current).toBe('item')
    rightClick(wrapper.get('#list').element)
    expect(seen).toEqual([undefined, undefined])
    expect(current).toBeUndefined()
    wrapper.unmount()
  })

  it('still clears the target after the trigger swaps its root element', async () => {
    const seen: unknown[] = []
    const Swap = defineComponent({
      props: { grid: Boolean },
      setup: (props) => () =>
        props.grid ? h('div', { id: 'grid' }, '网格') : h('ul', { id: 'list' }, '列表'),
    })
    const grid = ref(false)
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(
            DouContextMenu,
            { target: 'stale', 'onUpdate:target': (value: unknown) => seen.push(value) },
            {
              default: () => h(Swap, { grid: grid.value }),
              menu: () => h(DouDropdownItem, { value: 'open' }, () => '打开'),
            },
          ),
      }),
      { attachTo: document.body },
    )
    rightClick(wrapper.get('#list').element)
    expect(seen).toEqual([undefined])
    grid.value = true
    await nextTick()
    rightClick(wrapper.get('#grid').element)
    expect(seen).toEqual([undefined, undefined])
    // a right click elsewhere on the page leaves it alone
    rightClick(document.body)
    expect(seen).toHaveLength(2)
    wrapper.unmount()
  })

  it('stays closed when beforeOpen returns false, leaving the right click to the browser', async () => {
    const beforeOpen = vi.fn<(event: MouseEvent) => boolean | void>(() => false)
    const wrapper = make({ beforeOpen })
    const event = rightClick(wrapper.get('#area').element)
    await nextTick()
    expect(beforeOpen).toHaveBeenCalledWith(event)
    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.emitted('update:open')).toBeUndefined()
    // preventDefault() keeps it closed and the browser menu away
    beforeOpen.mockImplementation((e) => e.preventDefault())
    const prevented = rightClick(wrapper.get('#area').element)
    await nextTick()
    expect(prevented.defaultPrevented).toBe(true)
    expect(wrapper.emitted('update:open')).toBeUndefined()
    // otherwise it opens
    beforeOpen.mockImplementation(() => {})
    rightClick(wrapper.get('#area').element)
    await nextTick()
    expect(wrapper.emitted('update:open')).toEqual([[true]])
    wrapper.unmount()
  })

  it('warns once in development when beforeOpen returns a Promise', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const beforeOpen = (() => Promise.resolve(false)) as unknown as () => boolean
    const wrapper = make({ beforeOpen })
    rightClick(wrapper.get('#area').element)
    await nextTick()
    // the Promise is not waited for: the menu opens
    expect(wrapper.emitted('update:open')).toEqual([[true]])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('`beforeOpen` must decide on the spot'),
    )
    warn.mockRestore()
    wrapper.unmount()
  })

  it('leaves the right click to the outer menu when the inner beforeOpen returns false', async () => {
    const wrapper = mount(DouContextMenu, {
      slots: {
        default: () =>
          h('div', { id: 'outer' }, [
            h(
              DouContextMenu,
              { beforeOpen: () => false },
              {
                default: () => h('div', { id: 'inner' }, '内层'),
                menu: () => h(DouDropdownItem, { value: 'b' }, () => '内层菜单'),
              },
            ),
          ]),
        menu: () => h(DouDropdownItem, { value: 'a' }, () => '外层菜单'),
      },
      attachTo: document.body,
    })
    await settle()
    rightClick(wrapper.get('#inner').element)
    await nextTick()
    const shown = [...document.querySelectorAll<HTMLElement>('.dou-context-menu')].filter(
      (el) => el.style.display !== 'none',
    )
    expect(shown.map((el) => el.textContent?.trim())).toEqual(['外层菜单'])
    wrapper.unmount()
  })

  it('stays closed when an event inside the trigger already prevented it', async () => {
    const beforeOpen = vi.fn<(event: MouseEvent) => void>()
    const wrapper = mount(DouContextMenu, {
      props: { beforeOpen },
      slots: {
        default: () =>
          h('div', { id: 'area' }, [
            h('span', { id: 'locked', onContextmenu: (e: MouseEvent) => e.preventDefault() }),
          ]),
        menu: () => h(DouDropdownItem, { value: 'open' }, () => '打开'),
      },
      attachTo: document.body,
    })
    await settle()
    rightClick(wrapper.get('#locked').element)
    await nextTick()
    expect(beforeOpen).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    wrapper.unmount()
  })

  it('opens only the inner menu when two are nested', async () => {
    const wrapper = mount(DouContextMenu, {
      slots: {
        default: () =>
          h('div', { id: 'outer' }, [
            h(DouContextMenu, null, {
              default: () => h('div', { id: 'inner' }, '内层'),
              menu: () => h(DouDropdownItem, { value: 'b' }, () => '内层菜单'),
            }),
          ]),
        menu: () => h(DouDropdownItem, { value: 'a' }, () => '外层菜单'),
      },
      attachTo: document.body,
    })
    await settle()
    rightClick(wrapper.get('#inner').element)
    await nextTick()
    const shown = [...document.querySelectorAll<HTMLElement>('.dou-context-menu')].filter(
      (el) => el.style.display !== 'none',
    )
    expect(shown.map((el) => el.textContent?.trim())).toEqual(['内层菜单'])
    wrapper.unmount()
  })

  it('calls nothing and clears nothing when disabled', async () => {
    const beforeOpen = vi.fn<(event: MouseEvent) => void>()
    const wrapper = make({ disabled: true, target: 'a', beforeOpen })
    rightClick(wrapper.get('#area').element)
    expect(beforeOpen).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:target')).toBeUndefined()
    wrapper.unmount()
  })
})
