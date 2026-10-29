import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { Component } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouTable } from '../../../index'

const Table = DouTable as Component

const columns = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'city', title: '城市', filters: [{ label: '上海', value: '上海' }] },
]
const data = [
  { id: 1, name: '戴兜', city: '上海' },
  { id: 2, name: '小林', city: '杭州' },
  { id: 3, name: '阿青', city: '上海' },
]

const names = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('tbody tr.dou-table__row').map((row) => row.find('td:nth-child(2)').text())

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('DouTable draggable rows', () => {
  it('adds a handle column first, before the other utility columns', () => {
    const wrapper = mount(Table, {
      props: { columns, data, draggable: true, selectable: true, expandable: true },
    })
    const cells = wrapper.findAll('tbody tr.dou-table__row')[0]!.findAll('td')
    expect(cells[0]!.classes()).toEqual(expect.arrayContaining(['dou-table__drag', 'is-edge']))
    expect(cells[0]!.find('[data-dou-sortable-handle]').attributes('aria-label')).toBe('拖动排序')
    expect(cells[1]!.classes()).toContain('dou-table__expand')
    expect(cells[1]!.classes()).not.toContain('is-edge')
    expect(cells[2]!.classes()).toContain('dou-table__selection')
    expect(wrapper.findAll('thead th')[0]!.text()).toBe('排序')
  })

  it('reorders the rows with the keyboard and reports the new order', async () => {
    const wrapper = mount(Table, {
      props: {
        columns,
        data,
        draggable: true,
        'onUpdate:data': (value: unknown[]) => wrapper.setProps({ data: value }),
      },
      attachTo: document.body,
    })
    const handle = () => wrapper.findAll('[data-dou-sortable-handle]')[0]!
    await handle().trigger('keydown', { key: ' ' })
    expect(wrapper.find('tbody tr').classes()).toContain('is-lifted')
    await handle().trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(names(wrapper)).toEqual(['小林', '戴兜', '阿青'])
    const moved = wrapper.findAll('tbody tr.dou-table__row')[1]!
    await moved.find('[data-dou-sortable-handle]').trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('rowDrop')![0]).toEqual([{ row: data[0], oldIndex: 0, newIndex: 1 }])
    expect(wrapper.emitted('update:data')![0]![0]).toEqual([data[1], data[0], data[2]])
  })

  it('pauses while the rows are sorted or filtered', async () => {
    const wrapper = mount(Table, { props: { columns, data, draggable: true } })
    await wrapper.setProps({ sort: { key: 'name', order: 'asc' } })
    expect(wrapper.find('[data-dou-sortable-handle]').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ sort: null, filters: { city: ['上海'] } })
    expect(wrapper.find('[data-dou-sortable-handle]').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ filters: {} })
    expect(wrapper.find('[data-dou-sortable-handle]').attributes('disabled')).toBeUndefined()
  })

  it('drags a row with the pointer, following it with a one-row copy of the table', async () => {
    const wrapper = mount(Table, {
      props: { columns, data, draggable: true },
      attachTo: document.body,
    })
    const rows = wrapper.findAll('tbody tr.dou-table__row')
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(rows[2]!.find('td:nth-child(2)').element)
    await rows[0]!.find('[data-dou-sortable-handle]').trigger('pointerdown', {
      button: 0,
      clientX: 0,
      clientY: 0,
    })
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 90 }))
    await nextTick()
    const ghost = document.querySelector('.dou-table__ghost')
    expect(ghost?.classList).toContain('dou-table')
    expect(ghost?.querySelector('tr')?.textContent).toContain('戴兜')
    expect(names(wrapper)).toEqual(['小林', '阿青', '戴兜'])
    window.dispatchEvent(new PointerEvent('pointerup'))
    await nextTick()
    expect(document.querySelector('.dou-table__ghost')).toBeNull()
    expect(wrapper.emitted('rowDrop')![0]).toEqual([{ row: data[0], oldIndex: 0, newIndex: 2 }])
  })
})
