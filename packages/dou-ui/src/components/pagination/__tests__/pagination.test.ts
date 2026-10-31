import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouPagination, paginationRange } from '../../../index'

const show = (items: ReturnType<typeof paginationRange>) =>
  items.map((item) => (item.type === 'page' ? item.page : '…')).join(' ')

describe('paginationRange', () => {
  it('shows every page when they fit', () => {
    expect(show(paginationRange(1, 7, 1, 1))).toBe('1 2 3 4 5 6 7')
  })

  it('keeps the same length on every page', () => {
    expect(show(paginationRange(1, 20, 1, 1))).toBe('1 2 3 4 5 … 20')
    expect(show(paginationRange(4, 20, 1, 1))).toBe('1 2 3 4 5 … 20')
    expect(show(paginationRange(5, 20, 1, 1))).toBe('1 … 4 5 6 … 20')
    expect(show(paginationRange(16, 20, 1, 1))).toBe('1 … 15 16 17 … 20')
    expect(show(paginationRange(17, 20, 1, 1))).toBe('1 … 16 17 18 19 20')
    expect(show(paginationRange(20, 20, 1, 1))).toBe('1 … 16 17 18 19 20')
  })

  it('honours siblings and boundaries', () => {
    expect(show(paginationRange(10, 20, 2, 2))).toBe('1 2 … 8 9 10 11 12 … 19 20')
  })
})

describe('DouPagination', () => {
  it('renders a labelled navigation with the current page marked', () => {
    const wrapper = mount(DouPagination, { props: { total: 95, page: 3 } })
    expect(wrapper.attributes('aria-label')).toBe('分页')
    const current = wrapper.get('[aria-current="page"]')
    expect(current.text()).toBe('3')
    expect(current.attributes('aria-label')).toBe('第 3 页')
    expect(
      wrapper
        .findAll('.dou-pagination__pages button:not(.dou-pagination__ellipsis)')
        .map((b) => b.text()),
    ).toEqual(['1', '2', '3', '4', '5', '10'])
  })

  it('pages with the buttons and emits change', async () => {
    const wrapper = mount(DouPagination, { props: { total: 50, page: 1 } })
    const [prev, next] = [
      wrapper.get('[aria-label="上一页"]'),
      wrapper.get('[aria-label="下一页"]'),
    ]
    expect(prev.attributes('disabled')).toBeDefined()
    await next.trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([[2]])
    expect(wrapper.emitted('change')).toEqual([[2, 10]])
    await wrapper.get('[aria-label="第 5 页"]').trigger('click')
    expect(wrapper.emitted('update:page')!.at(-1)).toEqual([5])
    expect(wrapper.get('[aria-label="下一页"]').attributes('disabled')).toBeDefined()
  })

  it('shows the total and the simple form', () => {
    const wrapper = mount(DouPagination, {
      props: { total: 95, page: 2, simple: true, showTotal: true },
    })
    expect(wrapper.get('.dou-pagination__total').text()).toBe('共 95 条')
    expect(wrapper.get('.dou-pagination__simple').text().replace(/\s+/g, '')).toBe('2/10')
    expect(wrapper.find('.dou-pagination__pages').exists()).toBe(false)
  })

  it('pulls the page back in range when the total shrinks', async () => {
    const wrapper = mount(DouPagination, { props: { total: 100, page: 10 } })
    await wrapper.setProps({ total: 30 })
    expect(wrapper.emitted('update:page')!.at(-1)).toEqual([3])
  })

  it('offers page sizes and keeps the first shown item in view', async () => {
    const wrapper = mount(DouPagination, {
      props: { total: 500, page: 3, pageSize: 10, pageSizes: [10, 50] },
    })
    const select = wrapper.get('[role="combobox"]')
    expect(select.attributes('aria-label')).toBe('每页条数')
    expect(select.text()).toBe('10 条/页')
    wrapper.findComponent({ name: 'DouSelect' }).vm.$emit('update:modelValue', 50)
    expect(wrapper.emitted('update:pageSize')).toEqual([[50]])
    // item 21 is on page 1 of 50 per page
    expect(wrapper.emitted('update:page')).toEqual([[1]])
    expect(wrapper.emitted('change')).toEqual([[1, 50]])
  })

  it('hides on a single page when asked', () => {
    const wrapper = mount(DouPagination, { props: { total: 5, hideOnSinglePage: true } })
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('disables every button', () => {
    const wrapper = mount(DouPagination, { props: { total: 30, page: 2, disabled: true } })
    expect(wrapper.findAll('button').every((b) => b.attributes('disabled') !== undefined)).toBe(
      true,
    )
  })
})

async function openGap(wrapper: ReturnType<typeof mount>, index: number) {
  await wrapper.findAll('.dou-pagination__ellipsis')[index]!.trigger('click')
  await nextTick()
  await nextTick()
  return document.querySelector<HTMLElement>('.dou-pagination__gap-list')!
}

describe('DouPagination jumping', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('lists the pages an ellipsis skips, rendering only the rows in view', async () => {
    const wrapper = mount(DouPagination, {
      props: { total: 99990, page: 1 },
      attachTo: document.body,
    })
    const ellipsis = wrapper.get('.dou-pagination__ellipsis')
    expect(ellipsis.attributes('aria-label')).toBe('第 6–9998 页')
    const list = await openGap(wrapper, 0)
    expect(list.getAttribute('role')).toBe('listbox')
    const options = list.querySelectorAll('[role="option"]')
    expect(options.length).toBeGreaterThan(0)
    expect(options.length).toBeLessThan(40)
    expect(options[0]!.textContent).toContain('6')
    wrapper.unmount()
  })

  it('moves with the keys and jumps on Enter', async () => {
    const wrapper = mount(DouPagination, {
      props: { total: 2000, page: 1 },
      attachTo: document.body,
    })
    const list = await openGap(wrapper, 0)
    const key = (name: string) =>
      list.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
    key('ArrowDown')
    key('ArrowDown')
    await nextTick()
    expect(list.getAttribute('aria-activedescendant')).toMatch(/-8$/)
    key('Enter')
    await nextTick()
    expect(wrapper.emitted('update:page')!.at(-1)).toEqual([8])
    wrapper.unmount()
  })

  it('starts a gap before the current page next to it', async () => {
    const wrapper = mount(DouPagination, {
      props: { total: 2000, page: 100 },
      attachTo: document.body,
    })
    const list = await openGap(wrapper, 0)
    expect(list.getAttribute('aria-activedescendant')).toMatch(/-98$/)
    wrapper.unmount()
  })

  it('jumps to a typed page, clamped to the last one', async () => {
    const wrapper = mount(DouPagination, {
      props: { total: 95, page: 1, showJumper: true },
      attachTo: document.body,
    })
    const input = wrapper.get('.dou-pagination__jump input')
    expect(input.attributes('aria-label')).toBe('跳转到页码')
    await input.setValue('7')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:page')!.at(-1)).toEqual([7])
    await input.setValue('99')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:page')!.at(-1)).toEqual([10])
    wrapper.unmount()
  })
})
