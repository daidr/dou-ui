import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouSheet, linkTarget, type SheetLinkOpenEvent, type SheetWorkbook } from '../index'
import { formatClip, parseClip } from '../core/clipboard'
import { SheetFormulaEngine } from '../formula/engine'
import type { SheetExpose } from '../types'

const book = (): SheetWorkbook => ({
  version: 1,
  sheets: [
    {
      name: '门店',
      cells: [
        [{ value: '官网', link: 'https://ui.daidr.me' }, '=HYPERLINK("#汇总!B1", "看汇总")'],
        ['上海', 120],
      ],
    },
    { name: '汇总', cells: [['合计', 120]] },
  ],
})

function setup(props: Record<string, unknown> = {}) {
  const doc = ref(book())
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: doc.value,
          'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
          ...props,
        }),
    ),
    { attachTo: document.body },
  )
  const input = wrapper.find('textarea').element as HTMLTextAreaElement
  const key = async (name: string, init: KeyboardEventInit = {}) => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
    )
    await nextTick()
  }
  const type = async (text: string) => {
    input.value += text
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }
  const focus = async () => {
    input.focus()
    await nextTick()
  }
  const cells = () => doc.value.sheets[0]!.cells
  return { wrapper, doc, grid, key, type, focus, cells, input }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('linkTarget', () => {
  it('follows web addresses and places in the workbook, and nothing else', () => {
    expect(linkTarget('https://ui.daidr.me/sheet/')).toEqual({
      kind: 'web',
      href: 'https://ui.daidr.me/sheet/',
    })
    expect(linkTarget('mailto:daidr@daidr.me')?.kind).toBe('web')
    expect(linkTarget('tel:10086')?.kind).toBe('web')
    expect(linkTarget('mailto:')).toBe(null)
    expect(linkTarget("#'汇总 表'!B2:C3")).toEqual({
      kind: 'cell',
      sheet: '汇总 表',
      range: { start: { row: 1, col: 1 }, end: { row: 2, col: 2 } },
    })
    expect(linkTarget('#$A$20')?.kind).toBe('cell')
    expect(linkTarget('javascript:alert(1)')).toBe(null)
    expect(linkTarget('data:text/html,hi')).toBe(null)
    expect(linkTarget('ui.daidr.me')).toBe(null)
    expect(linkTarget('#不是引用')).toBe(null)
  })
})

describe('HYPERLINK', () => {
  it('shows its text and makes the cell a link', () => {
    const engine = new SheetFormulaEngine(book())
    expect(engine.result(0, 'B1')).toBe('看汇总')
    expect(engine.link(0, 'B1')).toBe('#汇总!B1')
    // without a name, the address shows
    const other = new SheetFormulaEngine({
      version: 1,
      sheets: [{ name: 'a', cells: [['=HYPERLINK("https://ui.daidr.me")', '=A1']] }],
    })
    expect(other.result(0, 'A1')).toBe('https://ui.daidr.me')
    // a formula that only reads a link's cell isn't a link
    expect(other.link(0, 'B1')).toBeUndefined()
    expect(other.link(0, 'A2')).toBeUndefined()
  })

  it('follows the cell it reads its address from', () => {
    const engine = new SheetFormulaEngine({
      version: 1,
      sheets: [{ name: 'a', cells: [['https://a.example', '=HYPERLINK(A1, "去")']] }],
    })
    expect(engine.link(0, 'B1')).toBe('https://a.example')
    engine.update({
      before: engine.doc,
      doc: {
        version: 1,
        sheets: [{ name: 'a', cells: [['https://b.example', '=HYPERLINK(A1, "去")']] }],
      },
      steps: [{ type: 'setCell', sheet: 'a', row: 0, col: 0, cell: 'https://b.example' }],
    })
    expect(engine.link(0, 'B1')).toBe('https://b.example')
  })
})

describe('links in the grid', () => {
  it('marks linked cells, and shows the active one’s link under it', async () => {
    const { wrapper, focus } = setup()
    const cells = wrapper.findAll('.dou-sheet__cell')
    expect(cells[0]!.classes()).toContain('is-link')
    expect(cells[1]!.classes()).toContain('is-link')
    expect(cells[2]!.classes()).not.toContain('is-link')
    await focus()
    const card = wrapper.find('.dou-sheet__link')
    expect(card.exists()).toBe(true)
    const anchor = card.find('a')
    expect(anchor.attributes('href')).toBe('https://ui.daidr.me/')
    expect(anchor.attributes('target')).toBe('_blank')
    expect(anchor.attributes('rel')).toBe('noopener noreferrer')
    expect(anchor.text()).toBe('ui.daidr.me')
  })

  it('opens a web link, and goes to a place in the workbook', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const { grid, wrapper } = setup()
    expect(grid.value!.commands.run('link.open')).toBe(true)
    expect(open).toHaveBeenCalledWith('https://ui.daidr.me/', '_blank', 'noopener,noreferrer')
    grid.value!.select('B1')
    await nextTick()
    grid.value!.commands.run('link.open')
    await nextTick()
    await nextTick()
    expect(wrapper.find('.dou-sheet__cell').text()).toBe('合计')
    expect(wrapper.find('.dou-sheet__cell.is-active').text()).toBe('120')
  })

  it('lets the app take a link over, and says when one goes nowhere', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const events: SheetLinkOpenEvent[] = []
    const { grid, wrapper, doc, focus } = setup({
      onLinkOpen: (event: SheetLinkOpenEvent) => {
        events.push(event)
        if (event.target.kind === 'web') event.preventDefault()
      },
    })
    expect(grid.value!.commands.run('link.open')).toBe(true)
    expect(open).not.toHaveBeenCalled()
    expect(events[0]).toMatchObject({
      link: 'https://ui.daidr.me',
      cell: { sheet: 0, row: 0, col: 0 },
    })
    // a place in the workbook is a button, not a page address
    grid.value!.select('B1')
    await focus()
    const card = wrapper.find('.dou-sheet__link')
    expect(card.find('a').exists()).toBe(false)
    expect(card.find('button.dou-sheet__link-address').text()).toBe('#汇总!B1')
    // a sheet that is gone
    doc.value = { ...doc.value, sheets: [doc.value.sheets[0]!] }
    await nextTick()
    grid.value!.commands.run('link.open')
    await nextTick()
    expect(wrapper.find('.dou-sheet__notice').text()).toBe('找不到链接指向的位置：#汇总!B1')
  })

  it('opens the box for a cell from code', async () => {
    const { wrapper, grid } = setup()
    grid.value!.editLink('A2')
    await nextTick()
    await nextTick()
    expect(wrapper.find('.dou-sheet__link.is-editing').exists()).toBe(true)
  })

  it('writes and takes off links from the box', async () => {
    const { wrapper, grid, key, focus, cells } = setup()
    grid.value!.select('A2')
    await focus()
    await key('k', { ctrlKey: true })
    const box = wrapper.find('.dou-sheet__link.is-editing')
    expect(box.exists()).toBe(true)
    const [text, address] = box.findAll('input')
    expect(text!.element.value).toBe('上海')
    await address!.setValue('javascript:alert(1)')
    await box.find('form').trigger('submit')
    // refused, and said why
    expect(box.find('.dou-sheet__link-problem').exists()).toBe(true)
    await address!.setValue('https://ui.daidr.me/sh')
    await text!.setValue('上海店')
    await box.find('form').trigger('submit')
    expect(cells()[1]![0]).toEqual({ value: '上海店', link: 'https://ui.daidr.me/sh' })
    grid.value!.commands.run('link.remove')
    expect(cells()[1]![0]).toBe('上海店')
  })

  it('turns a typed web address into a link', async () => {
    const { key, type, cells, input } = setup()
    await key('ArrowDown')
    await key('ArrowRight')
    await type('https://ui.daidr.me')
    await key('Enter')
    expect(cells()[1]![1]).toEqual({ value: 'https://ui.daidr.me', link: 'https://ui.daidr.me' })
    // typed again, the link follows; text that isn't an address takes it off
    await key('ArrowUp')
    await key('F2')
    input.value = 'https://ui.daidr.me/sheet/'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await key('Enter')
    expect(cells()[1]![1]).toEqual({
      value: 'https://ui.daidr.me/sheet/',
      link: 'https://ui.daidr.me/sheet/',
    })
    await key('ArrowUp')
    await type('上海')
    await key('Enter')
    expect(cells()[1]![1]).toBe('上海')
    // a link given otherwise stays
    await key('ArrowUp')
    await key('ArrowUp')
    await key('ArrowLeft')
    await type('主页')
    await key('Enter')
    expect(cells()[0]![0]).toEqual({ value: '主页', link: 'https://ui.daidr.me' })
  })

  it('puts the card away with Escape until another cell is active', async () => {
    const { wrapper, key, focus } = setup()
    await focus()
    expect(wrapper.find('.dou-sheet__link').exists()).toBe(true)
    await key('Escape')
    expect(wrapper.find('.dou-sheet__link').exists()).toBe(false)
    await key('ArrowRight')
    expect(wrapper.find('.dou-sheet__link').exists()).toBe(true)
    await key('ArrowLeft')
    expect(wrapper.find('.dou-sheet__link').exists()).toBe(true)
  })
})

describe('links on the clipboard', () => {
  it('copies a link as one, and reads one pasted from elsewhere', () => {
    const { html } = formatClip({ cells: [[{ value: '官网', link: 'https://ui.daidr.me' }]] })
    expect(html).toContain('<a href="https://ui.daidr.me/">官网</a>')
    const clip = parseClip({
      html: '<table><tr><td><a href="https://ui.daidr.me">官网</a></td><td><a href="javascript:x">坏</a></td></tr></table>',
    })
    expect(clip!.cells[0]).toEqual([{ value: '官网', link: 'https://ui.daidr.me/' }, '坏'])
  })
})
