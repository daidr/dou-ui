import { mount } from '@vue/test-utils'
import { h } from 'vue'
import type { Component } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouTable } from '../../../index'

const Table = DouTable as Component

const columns = [
  { key: 'name', title: '名称', width: 160, fixed: 'start' as const, sortable: true },
  { key: 'region', title: '区域', width: 200 },
  { key: 'cpu', title: 'CPU', width: 120 },
  { key: 'actions', title: '操作', width: 96, fixed: 'end' as const },
]
const data = [
  { id: 1, name: 'b-api', region: '上海', cpu: 2 },
  { id: 2, name: 'a-web', region: '新加坡', cpu: 4 },
]

const bodyRows = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('tbody tr.dou-table__row')

describe('DouTable fixed columns', () => {
  it('sticks fixed columns at the widths before them, utility columns included', () => {
    const wrapper = mount(Table, { props: { columns, data, selectable: true } })
    const head = wrapper.findAll('thead th')
    expect(head[0]!.classes()).toContain('is-fixed-start')
    expect(head[0]!.attributes('style')).toContain('inset-inline-start: 0px')
    expect(head[1]!.classes()).toEqual(
      expect.arrayContaining(['is-fixed-start', 'is-fixed-start-edge']),
    )
    expect(head[1]!.attributes('style')).toContain('inset-inline-start: 40px')
    expect(head[4]!.classes()).toEqual(
      expect.arrayContaining(['is-fixed-end', 'is-fixed-end-edge']),
    )
    expect(head[4]!.attributes('style')).toContain('inset-inline-end: 0px')
    expect(wrapper.classes()).toContain('is-fixed-layout')
  })
})

describe('DouTable detail rows', () => {
  it('opens a detail row under a row with the expand slot', async () => {
    const wrapper = mount(Table, {
      props: {
        columns,
        data,
        expandable: (row: { id: number }) => row.id === 1,
        expanded: [],
        'onUpdate:expanded': (keys: number[]) => wrapper.setProps({ expanded: keys }),
      },
      slots: { expand: ({ row }: { row: { name: string } }) => h('p', `详情：${row.name}`) },
    })
    const toggles = wrapper.findAll('.dou-table__expand button')
    expect(toggles).toHaveLength(1)
    expect(toggles[0]!.attributes('aria-expanded')).toBe('false')
    await toggles[0]!.trigger('click')
    const detail = wrapper.get('.dou-table__detail-row')
    expect(detail.text()).toBe('详情：b-api')
    expect(toggles[0]!.attributes('aria-expanded')).toBe('true')
    expect(toggles[0]!.attributes('aria-controls')).toBe(detail.attributes('id'))
    expect(detail.get('td').attributes('colspan')).toBe('5')
  })
})

describe('DouTable tree data', () => {
  const tree = [
    {
      id: 1,
      name: 'team',
      region: '-',
      cpu: 6,
      children: [
        { id: 11, name: 'z-svc', region: '上海', cpu: 4 },
        { id: 12, name: 'a-svc', region: '上海', cpu: 2 },
      ],
    },
    { id: 2, name: 'solo', region: '新加坡', cpu: 1 },
  ]

  it('shows children of expanded rows, indented, sorted among siblings', async () => {
    const wrapper = mount(Table, {
      props: {
        columns,
        data: tree,
        sort: { key: 'name', order: 'asc' },
        expanded: [],
        'onUpdate:expanded': (keys: number[]) => wrapper.setProps({ expanded: keys }),
      },
    })
    expect(bodyRows(wrapper).map((r) => r.findAll('td')[0]!.text())).toEqual(['solo', 'team'])
    const toggle = wrapper.get('.dou-table__tree button')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(bodyRows(wrapper).map((r) => r.findAll('td')[0]!.text())).toEqual([
      'solo',
      'team',
      'a-svc',
      'z-svc',
    ])
    const child = bodyRows(wrapper)[2]!.get('.dou-table__tree')
    expect(child.attributes('style')).toContain('padding-inline-start: 16px')
    expect(child.find('.dou-table__toggle-space').exists()).toBe(true)
  })

  it('selects every row, children included', async () => {
    const wrapper = mount(Table, { props: { columns, data: tree, selectable: true } })
    await wrapper.get('thead input').setValue(true)
    expect(wrapper.emitted('update:selected')![0]).toEqual([[1, 11, 12, 2]])
  })
})

describe('DouTable resizing', () => {
  it('resizes a column with the keyboard and reports it', async () => {
    const wrapper = mount(Table, { props: { columns, data, resizable: true } })
    const handle = wrapper.findAll('[role="separator"]')[1]!
    expect(handle.attributes('aria-label')).toBe('调整“区域”列宽')
    expect(handle.attributes('aria-valuenow')).toBe('200')
    await handle.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('columnResize')![0]).toEqual(['region', 208])
    await handle.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(wrapper.emitted('columnResize')![1]).toEqual(['region', 176])
    expect(handle.attributes('aria-valuenow')).toBe('176')
    expect(wrapper.findAll('col')[1]!.attributes('style')).toContain('width: 176px')
  })

  it('never resizes below the minimum width', async () => {
    const wrapper = mount(Table, {
      props: { columns: [{ key: 'name', title: '名称', width: 60, resizable: true }], data },
    })
    const handle = wrapper.get('[role="separator"]')
    await handle.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(wrapper.emitted('columnResize')![0]).toEqual(['name', 48])
  })
})

describe('DouTable summary', () => {
  it('renders a summary row from all rows', () => {
    const wrapper = mount(Table, {
      props: {
        columns,
        data,
        summary: (rows: { cpu: number }[]) => ({
          name: '合计',
          cpu: rows.reduce((sum, row) => sum + row.cpu, 0),
        }),
      },
    })
    const cells = wrapper.findAll('tfoot td').map((td) => td.text())
    expect(cells).toEqual(['合计', '', '6', ''])
  })
})

describe('DouTable virtual rows', () => {
  const many = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `row-${i}`,
    region: '',
    cpu: i,
  }))

  it('renders only the rows in view with spacers for the rest', () => {
    const wrapper = mount(Table, {
      props: { columns, data: many, virtual: true, maxHeight: 440, rowHeight: 44 },
    })
    const rows = bodyRows(wrapper)
    expect(rows.length).toBeLessThan(40)
    expect(rows[0]!.attributes('aria-rowindex')).toBe('2')
    expect(wrapper.get('table').attributes('aria-rowcount')).toBe('1001')
    const spacers = wrapper.findAll('.dou-table__spacer td')
    expect(spacers).toHaveLength(1)
    expect(spacers[0]!.attributes('style')).toContain(`height: ${(1000 - rows.length) * 44}px`)
  })
})
