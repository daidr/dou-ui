import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Component } from 'vue'
import { DouTable } from '../../../index'
import type { TableColumn } from '../../../index'

interface Row {
  id: number
  name: string
  region: string
  replicas: number
}

const data: Row[] = [
  { id: 1, name: 'edge-fn-sh', region: '上海', replicas: 3 },
  { id: 2, name: 'api-sg', region: '新加坡', replicas: 12 },
  { id: 3, name: 'cron-fra', region: '法兰克福', replicas: 1 },
]

const columns: TableColumn<Row>[] = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'region', title: '区域' },
  { key: 'replicas', title: '副本', align: 'end', sortable: true },
]

// A generic component infers its row type from the props it is given;
// these tests check the rendering, so mount it untyped.
const Table = DouTable as Component

const cells = (wrapper: ReturnType<typeof mount>, column: number) =>
  wrapper.findAll('tbody tr').map((tr) => tr.findAll('td')[column]!.text())

describe('DouTable', () => {
  it('renders headers and rows', () => {
    const wrapper = mount(Table, { props: { data, columns } })
    expect(wrapper.findAll('th').map((th) => th.text())).toEqual(['名称', '区域', '副本'])
    expect(wrapper.findAll('th').every((th) => th.attributes('scope') === 'col')).toBe(true)
    expect(cells(wrapper, 0)).toEqual(['edge-fn-sh', 'api-sg', 'cron-fra'])
    expect(wrapper.findAll('tbody tr')[0]!.findAll('td')[2]!.classes()).toContain('is-end')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-table', 'dou-table--md']))
  })

  it('sorts by a sortable column: ascending, descending, then off', async () => {
    const wrapper = mount(Table, {
      props: {
        data,
        columns,
        'onUpdate:sort': (sort: unknown) => wrapper.setProps({ sort: sort as never }),
      },
    })
    const header = () => wrapper.findAll('th')[2]!
    expect(header().attributes('aria-sort')).toBe('none')
    expect(wrapper.findAll('th')[1]!.attributes('aria-sort')).toBeUndefined()

    await header().get('button').trigger('click')
    expect(header().attributes('aria-sort')).toBe('ascending')
    expect(cells(wrapper, 2)).toEqual(['1', '3', '12'])

    await header().get('button').trigger('click')
    expect(header().attributes('aria-sort')).toBe('descending')
    expect(cells(wrapper, 2)).toEqual(['12', '3', '1'])

    await header().get('button').trigger('click')
    expect(header().attributes('aria-sort')).toBe('none')
    expect(cells(wrapper, 2)).toEqual(['3', '12', '1'])
  })

  it('compares text in the locale, with numbers inside text in order', () => {
    const rows = [
      { id: 1, name: 'node-10', region: '', replicas: 0 },
      { id: 2, name: 'node-2', region: '', replicas: 0 },
    ]
    const wrapper = mount(Table, {
      props: { data: rows, columns, sort: { key: 'name', order: 'asc' } },
    })
    expect(cells(wrapper, 0)).toEqual(['node-2', 'node-10'])
  })

  it('leaves the order alone with manualSort', () => {
    const wrapper = mount(Table, {
      props: { data, columns, manualSort: true, sort: { key: 'replicas', order: 'asc' } },
    })
    expect(cells(wrapper, 2)).toEqual(['3', '12', '1'])
  })

  it('selects rows and all rows', async () => {
    const wrapper = mount(Table, {
      props: {
        data,
        columns,
        selectable: (row: Row) => row.id !== 3,
        selected: [] as number[],
        'onUpdate:selected': (keys: unknown) => wrapper.setProps({ selected: keys as number[] }),
      },
    })
    const boxes = () => wrapper.findAll('input[type="checkbox"]')
    expect(boxes()[0]!.attributes('aria-label')).toBe('选择全部')
    expect(boxes()[1]!.attributes('aria-label')).toBe('选择此行')
    expect(boxes()[3]!.attributes('disabled')).toBeDefined()

    await boxes()[1]!.setValue(true)
    expect(wrapper.props('selected')).toEqual([1])
    expect((boxes()[0]!.element as HTMLInputElement).indeterminate).toBe(true)
    expect(wrapper.findAll('tbody tr')[0]!.classes()).toContain('is-selected')

    await boxes()[0]!.setValue(true)
    expect(wrapper.props('selected')).toEqual([1, 2])
    await boxes()[0]!.setValue(false)
    expect(wrapper.props('selected')).toEqual([])
  })

  it('renders cell slots, a value getter and a row click', async () => {
    const wrapper = mount(Table, {
      props: {
        data,
        columns: [
          { key: 'name', title: '名称' },
          { key: 'label', title: '标签', value: (row: Row) => `${row.name}@${row.region}` },
        ],
      },
      slots: { 'cell-name': ({ value }: { value: unknown }) => `[${String(value)}]` },
    })
    expect(cells(wrapper, 0)[0]).toBe('[edge-fn-sh]')
    expect(cells(wrapper, 1)[0]).toBe('edge-fn-sh@上海')
    await wrapper.findAll('tbody tr')[1]!.trigger('click')
    expect(wrapper.emitted('rowClick')![0]![1]).toBe(1)
  })

  it('shows the empty state and the loading state', async () => {
    const wrapper = mount(Table, { props: { data: [], columns, emptyText: '没有实例' } })
    expect(wrapper.get('td.dou-table__empty').attributes('colspan')).toBe('3')
    expect(wrapper.get('.dou-empty__title').text()).toBe('没有实例')
    await wrapper.setProps({ loading: true })
    expect(wrapper.get('table').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.dou-table__loading').exists()).toBe(true)
    expect(wrapper.find('.dou-empty').exists()).toBe(false)
  })

  it('pins the header under a max height', () => {
    const wrapper = mount(Table, { props: { data, columns, maxHeight: 200 } })
    expect(wrapper.classes()).toContain('is-scroll')
    expect(wrapper.get('.dou-table__wrapper').attributes('style')).toContain('max-height: 200px')
  })
})
