import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouCommand, DouCommandDialog, fuzzyMatch } from '../../../index'
import type { CommandItem } from '../../../index'

const items: CommandItem[] = [
  { value: 'new', label: '新建项目', group: '操作', shortcut: 'mod+n' },
  { value: 'deploy', label: 'Deploy to production', group: '操作', keywords: ['上线', 'release'] },
  { value: 'disabled', label: 'Delete project', group: '操作', disabled: true },
  { value: 'settings', label: 'Open settings', group: '导航', description: '域名、环境变量与权限' },
  { value: 'docs', label: 'Documentation', group: '导航' },
]

afterEach(() => {
  document.body.innerHTML = ''
})

describe('fuzzyMatch', () => {
  it('prefers substrings and word starts', () => {
    expect(fuzzyMatch('Open settings', 'set')!.indices).toEqual([5, 6, 7])
    expect(fuzzyMatch('Deploy to production', 'dtp')!.indices).toEqual([0, 7, 10])
    expect(fuzzyMatch('Deploy', 'xyz')).toBeNull()
    const prefix = fuzzyMatch('Documentation', 'doc')!.score
    const inner = fuzzyMatch('Open docs', 'doc')!.score
    expect(prefix).toBeGreaterThan(inner)
  })
})

describe('DouCommand', () => {
  it('lists the items in groups with combobox semantics', () => {
    const wrapper = mount(DouCommand, { props: { items }, attachTo: document.body })
    const input = wrapper.get('input')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('placeholder')).toBe('输入命令或搜索…')
    expect(wrapper.findAll('[role="group"]')).toHaveLength(2)
    expect(wrapper.findAll('.dou-command__group-label').map((label) => label.text())).toEqual([
      '操作',
      '导航',
    ])
    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(5)
    expect(input.attributes('aria-activedescendant')).toBe(options[0]!.attributes('id'))
    wrapper.unmount()
  })

  it("shows a shortcut as this platform's keys", () => {
    const wrapper = mount(DouCommand, { props: { items }, attachTo: document.body })
    const option = wrapper.findAll('[role="option"]')[0]!
    expect(option.get('.dou-command__shortcut').text()).toBe('CtrlN')
    expect(option.attributes('aria-keyshortcuts')).toBe('Control+N')
    expect(wrapper.findAll('[role="option"]')[1]!.attributes('aria-keyshortcuts')).toBeUndefined()
  })

  it('filters, ranks and highlights', async () => {
    const wrapper = mount(DouCommand, { props: { items }, attachTo: document.body })
    await wrapper.get('input').setValue('do')
    const labels = wrapper.findAll('[role="option"]').map((option) => option.text())
    // "Documentation" starts with it; "Deploy to production" only spells it out
    expect(labels[0]).toBe('Documentation')
    expect(labels).toContain('Deploy to production')
    expect(wrapper.find('.dou-command__match').text()).toBe('Do')

    await wrapper.get('input').setValue('上线')
    expect(wrapper.findAll('[role="option"]').map((option) => option.text())).toEqual([
      'Deploy to production',
    ])

    await wrapper.get('input').setValue('zzz')
    expect(wrapper.get('.dou-command__empty').text()).toBe('没有匹配的结果')
    wrapper.unmount()
  })

  it('moves with the arrows, skipping disabled items, and selects with Enter', async () => {
    const wrapper = mount(DouCommand, { props: { items }, attachTo: document.body })
    const input = wrapper.get('input')
    const active = () => wrapper.get(`#${input.attributes('aria-activedescendant')}`).text()
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(active()).toContain('Open settings')
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')![0]![0]).toMatchObject({ value: 'deploy' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    // wraps around
    expect(active()).toBe('Documentation')
    wrapper.unmount()
  })
})

describe('DouCommandDialog', () => {
  it('opens with the hotkey, focuses the search and closes on select', async () => {
    const wrapper = mount(DouCommandDialog, {
      props: { items, hotkey: 'ctrl+k' },
      attachTo: document.body,
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await nextTick()
    expect(wrapper.emitted('update:open')![0]).toEqual([true])
    await wrapper.setProps({ open: true })
    await nextTick()
    await nextTick()
    const input = document.querySelector<HTMLInputElement>('.dou-command__input')!
    expect(document.activeElement).toBe(input)
    expect(document.querySelector('[role="dialog"]')!.getAttribute('aria-label')).toBe(
      '输入命令或搜索…',
    )
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('select')![0]![0]).toMatchObject({ value: 'new' })
    expect(wrapper.emitted('update:open')!.at(-1)).toEqual([false])
    wrapper.unmount()
  })
})

describe('DouCommand highlight', () => {
  it('keeps the highlight when the parent passes an equal list again', async () => {
    const wrapper = mount(DouCommand, { props: { items }, attachTo: document.body })
    const input = wrapper.get('input')
    await input.trigger('keydown', { key: 'ArrowDown' })
    const before = input.attributes('aria-activedescendant')
    await wrapper.setProps({ items: items.map((item) => ({ ...item })) })
    expect(input.attributes('aria-activedescendant')).toBe(before)
    wrapper.unmount()
  })
})

const rows = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>('[role="option"]')]
const heights = (root: ParentNode) => rows(root).map((row) => row.style.height)
const many = (count: number): CommandItem[] =>
  Array.from({ length: count }, (_, index) => ({
    value: index,
    label: `第 ${index} 条`,
    description: index % 2 ? '上海 · 戴兜' : undefined,
  }))

const isRow = (el: Element) => el.getAttribute('role') === 'option'
/** The number in a row's label. */
const label = (row: HTMLElement) => Number(/第 (\d+) 条/.exec(row.textContent!)![1])

/**
 * A stand-in for layout in happy-dom: rows are `height(row)` tall and stack
 * under the spacers, the list shows 300px, and resize observers report
 * every observed row once it is rendered.
 */
function fakeLayout(height: (row: HTMLElement) => number) {
  const proto = HTMLElement.prototype
  const props = [
    'offsetHeight',
    'clientHeight',
    'scrollHeight',
    'scrollTop',
    'getBoundingClientRect',
  ] as const
  const own = props.map((name) => Object.getOwnPropertyDescriptor(proto, name))
  const saved = {
    ResizeObserver: globalThis.ResizeObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  }
  const sizeOf = (el: Element): number => {
    if (isRow(el)) return height(el as HTMLElement)
    const style = (el as HTMLElement).style?.height
    return style ? Number.parseFloat(style) : 0
  }
  const topOf = (el: Element) => {
    let top = 0
    for (let at = el.previousElementSibling; at; at = at.previousElementSibling) top += sizeOf(at)
    return top
  }
  const tops = new WeakMap<Element, number>()
  const state = { dropWrites: false }
  // the content is the groups' children stacked, shown 300px at a time
  const contentOf = (el: Element) => {
    let content = 0
    for (const group of el.children) for (const child of group.children) content += sizeOf(child)
    return content
  }
  const clamp = (el: Element, top: number) => Math.max(0, Math.min(top, contentOf(el) - 300))
  // Where an element is on screen: the list sits at 0 and its content scrolls.
  const screenTop = (el: Element): number => {
    if (el.getAttribute('role') === 'listbox') return 0
    const parent = el.parentElement
    if (!parent) return 0
    const inner = parent.getAttribute('role') === 'listbox' ? -(tops.get(parent) ?? 0) : 0
    return screenTop(parent) + inner + topOf(el)
  }
  Object.defineProperty(proto, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      const top = this.closest('[role="listbox"]') ? screenTop(this) : 0
      return new DOMRect(0, top, 0, sizeOf(this))
    },
  })
  Object.defineProperty(proto, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return sizeOf(this)
    },
  })
  Object.defineProperty(proto, 'clientHeight', {
    configurable: true,
    get(this: Element) {
      return this.getAttribute('role') === 'listbox' ? 300 : 0
    },
  })
  Object.defineProperty(proto, 'scrollHeight', {
    configurable: true,
    get(this: Element) {
      return this.getAttribute('role') === 'listbox' ? contentOf(this) : 0
    },
  })
  Object.defineProperty(proto, 'scrollTop', {
    configurable: true,
    get(this: Element) {
      return tops.get(this) ?? 0
    },
    set(this: Element, value: number) {
      // iOS drops positions written by code during a touch scroll
      if (state.dropWrites) return
      const next = clamp(this, value)
      if (next === (tops.get(this) ?? 0)) return
      tops.set(this, next)
      queueMicrotask(() => this.dispatchEvent(new Event('scroll')))
    },
  })
  const observers = new Set<{ fire: () => void }>()
  globalThis.ResizeObserver = class {
    targets = new Set<Element>()
    constructor(private callback: ResizeObserverCallback) {
      observers.add(this)
    }
    observe(target: Element) {
      this.targets.add(target)
    }
    unobserve(target: Element) {
      this.targets.delete(target)
    }
    disconnect() {
      this.targets.clear()
    }
    fire() {
      const entries = [...this.targets].filter(isRow).map((target) => ({ target }))
      if (entries.length) this.callback(entries as never, this as never)
    }
  } as never
  globalThis.requestAnimationFrame = ((step: FrameRequestCallback) =>
    setTimeout(() => step(0), 0)) as never
  return {
    state,
    topOf: (row: HTMLElement) => topOf(row),
    /** Where a row shows, from the top of the list's view. */
    shownAt: (row: HTMLElement) => screenTop(row),
    /** The reader scrolling by `delta`, which iOS never drops. */
    scrollBy(list: HTMLElement, delta: number) {
      tops.set(list, clamp(list, (tops.get(list) ?? 0) + delta))
      list.dispatchEvent(new Event('scroll'))
    },
    async settle() {
      for (let frame = 0; frame < 8; frame++) {
        await nextTick()
        for (const observer of observers) observer.fire()
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    },
    restore() {
      props.forEach((name, at) => {
        delete (proto as unknown as Record<string, unknown>)[name]
        if (own[at]) Object.defineProperty(proto, name, own[at])
      })
      globalThis.ResizeObserver = saved.ResizeObserver
      globalThis.requestAnimationFrame = saved.requestAnimationFrame
    },
  }
}

describe('DouCommand row height', () => {
  it('leaves rows to their content unless the list is virtual', () => {
    const wrapper = mount(DouCommand, { props: { items, virtual: false } })
    expect(heights(wrapper.element).every((height) => height === '')).toBe(true)
    wrapper.unmount()
  })

  it('gives each virtual row its itemSize, by number or by item', async () => {
    const wrapper = mount(DouCommand, { props: { items: many(30), virtual: true } })
    await nextTick()
    expect(new Set(heights(wrapper.element))).toEqual(new Set(['']))
    await wrapper.setProps({ itemSize: 52 })
    expect(new Set(heights(wrapper.element))).toEqual(new Set(['52px']))
    await wrapper.setProps({
      itemSize: (item: CommandItem) => (item.description ? 52 : 36),
    })
    expect(heights(wrapper.element).slice(0, 2)).toEqual(['36px', '52px'])
    wrapper.unmount()
  })

  it('lets an itemSize under 36 win over the minimum height', async () => {
    const wrapper = mount(DouCommand, { props: { items: many(30), virtual: true, itemSize: 28 } })
    await nextTick()
    const row = rows(wrapper.element)[0]!
    expect([row.style.height, row.style.minHeight]).toEqual(['28px', '28px'])
    wrapper.unmount()
  })

  it('measures virtual rows without itemSize and estimates the rest from them', async () => {
    const layout = fakeLayout(() => 52)
    try {
      const wrapper = mount(DouCommand, { props: { items: many(200) }, attachTo: document.body })
      await layout.settle()
      const shown = rows(wrapper.element).length
      expect(shown).toBeLessThan(200)
      const spacer = wrapper.element.querySelector('[role="group"]')!
        .lastElementChild as HTMLElement
      expect(spacer.style.height).toBe(`${(200 - shown) * 52}px`)
      wrapper.unmount()
    } finally {
      layout.restore()
    }
  })

  it('lands on a far item once the rows around it are measured', async () => {
    // the first half one line, the second half two
    const layout = fakeLayout((row) =>
      Number(/第 (\d+) 条/.exec(row.textContent!)![1]) < 100 ? 36 : 72,
    )
    try {
      const wrapper = mount(DouCommand, { props: { items: many(200) }, attachTo: document.body })
      await layout.settle()
      const input = wrapper.get('input')
      await input.trigger('keydown', { key: 'End', ctrlKey: true })
      await layout.settle()
      const id = input.attributes('aria-activedescendant')!
      const row = document.getElementById(id)
      expect(row).not.toBeNull()
      const list = wrapper.get('[role="listbox"]').element as HTMLElement
      const top = layout.topOf(row!)
      expect(top).toBeGreaterThanOrEqual(list.scrollTop)
      expect(top + 72).toBeLessThanOrEqual(list.scrollTop + 300)
      wrapper.unmount()
    } finally {
      layout.restore()
    }
  })

  it('keeps what is in view in place scrolling up past rows not measured yet, also on iOS', async () => {
    // every fifth row is much taller than the first ones shown
    const layout = fakeLayout((row) => (label(row) % 5 ? 52 : 140))
    try {
      const wrapper = mount(DouCommand, { props: { items: many(300) }, attachTo: document.body })
      await layout.settle()
      const list = wrapper.get('[role="listbox"]').element as HTMLElement
      for (let step = 0; step < 6; step++) {
        list.scrollTop = 100_000
        await layout.settle()
      }
      const watched = () =>
        rows(list).find((row) => layout.shownAt(row) >= 0 && layout.shownAt(row) < 300)!
      // without a touch, then with one where iOS drops every move made by code
      for (const touch of [false, true]) {
        const row = watched()
        const name = row.textContent
        const before = layout.shownAt(row)
        if (touch) {
          document.dispatchEvent(new Event('touchstart'))
          layout.state.dropWrites = true
        }
        for (let step = 0; step < 4; step++) {
          layout.scrollBy(list, -30)
          await layout.settle()
        }
        if (touch) {
          layout.state.dropWrites = false
          document.dispatchEvent(Object.assign(new Event('touchend'), { touches: [] }))
          await new Promise((resolve) => setTimeout(resolve, 200))
          await layout.settle()
        }
        const same = rows(list).find((each) => each.textContent === name)!
        expect(layout.shownAt(same)).toBeCloseTo(before + 120, 0)
      }
      wrapper.unmount()
    } finally {
      layout.restore()
    }
  })

  it('passes virtual and itemSize through the dialog', async () => {
    const wrapper = mount(DouCommandDialog, {
      props: { items: many(30), open: true, virtual: true, itemSize: 48 },
      attachTo: document.body,
    })
    await nextTick()
    expect(new Set(heights(document))).toEqual(new Set(['48px']))
    wrapper.unmount()
  })

  it('turns virtual on by itself for a long list in the dialog', async () => {
    const wrapper = mount(DouCommandDialog, {
      props: { items: many(150), open: true },
      attachTo: document.body,
    })
    await nextTick()
    expect(rows(document).length).toBeLessThan(150)
    wrapper.unmount()
  })
})
