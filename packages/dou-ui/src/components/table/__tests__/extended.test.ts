import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { Component } from 'vue'
import { DouTable } from '../../../index'
import type { TableColumn, TableExpose } from '../../../index'

interface Row {
  id: number
  name: string
  region: string
  cpu: number
  memory: number
  children?: Row[]
  hasChildren?: boolean
}

const data: Row[] = [
  { id: 1, name: 'edge-fn-sh', region: '上海', cpu: 2, memory: 4 },
  { id: 2, name: 'api-sh', region: '上海', cpu: 4, memory: 8 },
  { id: 3, name: 'cron-fra', region: '法兰克福', cpu: 1, memory: 2 },
]

const Table = DouTable as Component

const bodyText = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('tbody tr').map((tr) => tr.findAll('td').map((td) => td.text()))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouTable grouped headers', () => {
  const columns: TableColumn<Row>[] = [
    { key: 'name', title: '名称' },
    {
      key: 'spec',
      title: '规格',
      children: [
        { key: 'cpu', title: 'CPU', align: 'end' },
        { key: 'memory', title: '内存', align: 'end' },
      ],
    },
  ]

  it('stacks group headers over their columns', () => {
    const wrapper = mount(Table, { props: { data, columns } })
    const rows = wrapper.findAll('thead tr')
    expect(rows).toHaveLength(2)
    const top = rows[0]!.findAll('th')
    expect(top.map((th) => th.text())).toEqual(['名称', '规格'])
    expect(top[0]!.attributes('rowspan')).toBe('2')
    expect(top[1]!.attributes('colspan')).toBe('2')
    expect(top[1]!.attributes('scope')).toBe('colgroup')
    expect(rows[1]!.findAll('th').map((th) => th.text())).toEqual(['CPU', '内存'])
    // only the data columns reach the body
    expect(bodyText(wrapper)[0]).toEqual(['edge-fn-sh', '2', '4'])
    expect(wrapper.findAll('col')).toHaveLength(3)
    expect(wrapper.classes()).toContain('is-grouped')
  })

  it('passes a group’s fixed side to its columns', () => {
    const wrapper = mount(Table, {
      props: {
        data,
        columns: [
          { key: 'name', title: '名称', width: 120 },
          {
            ...columns[1]!,
            fixed: 'end',
            children: columns[1]!.children!.map((c) => ({ ...c, width: 80 })),
          },
        ],
      },
    })
    const cells = wrapper.findAll('tbody tr')[0]!.findAll('td')
    expect(cells[1]!.classes()).toContain('is-fixed-end')
    expect(cells[2]!.attributes('style')).toContain('inset-inline-end: 0px')
    expect(cells[1]!.attributes('style')).toContain('inset-inline-end: 80px')
  })
})

describe('DouTable merged cells', () => {
  it('spans rows and columns and drops the covered cells', () => {
    const wrapper = mount(Table, {
      props: {
        data,
        columns: [
          { key: 'region', title: '区域' },
          { key: 'name', title: '名称' },
          { key: 'cpu', title: 'CPU' },
        ],
        spanMethod: ({ rowIndex, columnIndex }: { rowIndex: number; columnIndex: number }) => {
          if (columnIndex === 0)
            return rowIndex === 0 ? [2, 1] : rowIndex === 1 ? [0, 0] : undefined
          if (rowIndex === 2 && columnIndex === 1) return { colspan: 2 }
          if (rowIndex === 2 && columnIndex === 2) return { rowspan: 0, colspan: 0 }
        },
      },
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0]!.findAll('td')[0]!.attributes('rowspan')).toBe('2')
    expect(rows[1]!.findAll('td').map((td) => td.text())).toEqual(['api-sh', '4'])
    expect(rows[2]!.findAll('td')).toHaveLength(2)
    expect(rows[2]!.findAll('td')[1]!.attributes('colspan')).toBe('2')
  })
})

describe('DouTable filters', () => {
  const columns: TableColumn<Row>[] = [
    { key: 'name', title: '名称' },
    {
      key: 'region',
      title: '区域',
      filters: [
        { label: '上海', value: '上海' },
        { label: '法兰克福', value: '法兰克福' },
      ],
    },
  ]

  it('filters rows by the picked values', async () => {
    const wrapper = mount(Table, {
      props: {
        data,
        columns,
        filters: { region: ['法兰克福'] },
        'onUpdate:filters': (filters: unknown) => wrapper.setProps({ filters: filters as never }),
      },
      attachTo: document.body,
    })
    expect(bodyText(wrapper).map((row) => row[0])).toEqual(['cron-fra'])
    expect(wrapper.get('.dou-table__filter-trigger').classes()).toContain('is-active')
    // open the menu, add 上海 and apply
    await wrapper.get('.dou-table__filter-trigger').trigger('click')
    await nextTick()
    const boxes = document.querySelectorAll<HTMLInputElement>('.dou-table__filter input')
    expect(boxes[1]!.checked).toBe(true)
    boxes[0]!.click()
    await nextTick()
    const apply = [
      ...document.querySelectorAll<HTMLButtonElement>('.dou-table__filter-footer button'),
    ].at(-1)!
    apply.click()
    await nextTick()
    expect(wrapper.props('filters')).toEqual({ region: ['法兰克福', '上海'] })
    expect(bodyText(wrapper)).toHaveLength(3)
    wrapper.unmount()
  })

  it('applies a single choice at once, and only reports with manualFilter', async () => {
    const wrapper = mount(Table, {
      props: {
        data,
        columns: [columns[0]!, { ...columns[1]!, filterMultiple: false }],
        manualFilter: true,
        'onUpdate:filters': (filters: unknown) => wrapper.setProps({ filters: filters as never }),
      },
      attachTo: document.body,
    })
    await wrapper.get('.dou-table__filter-trigger').trigger('click')
    await nextTick()
    const options = document.querySelectorAll<HTMLButtonElement>('.dou-table__filter-option')
    expect([...options].map((option) => option.textContent!.trim())).toEqual([
      '全部',
      '上海',
      '法兰克福',
    ])
    options[1]!.click()
    await nextTick()
    expect(wrapper.props('filters')).toEqual({ region: ['上海'] })
    expect(bodyText(wrapper)).toHaveLength(3)
    wrapper.unmount()
  })

  it('keeps a tree row when one of its children passes', () => {
    const wrapper = mount(Table, {
      props: {
        data: [{ id: 9, name: 'group', region: '新加坡', cpu: 0, memory: 0, children: data }],
        columns,
        expanded: [9],
        filters: { region: ['法兰克福'] },
      },
    })
    expect(bodyText(wrapper).map((row) => row[0])).toEqual(['group', 'cron-fra'])
  })
})

describe('DouTable rows', () => {
  const columns: TableColumn<Row>[] = [
    { key: 'name', title: '名称' },
    { key: 'cpu', title: 'CPU' },
  ]

  it('highlights the current row and styles rows', async () => {
    const wrapper = mount(Table, {
      props: {
        data,
        columns,
        highlightCurrent: true,
        rowClass: (row: Row) => (row.cpu > 2 ? 'is-busy' : undefined),
        rowStyle: { color: 'red' },
        'onUpdate:current': (key: unknown) => wrapper.setProps({ current: key as never }),
      },
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows[1]!.classes()).toContain('is-busy')
    expect(rows[0]!.attributes('style')).toContain('color: red')
    await rows[2]!.trigger('click')
    expect(wrapper.props('current')).toBe(3)
    expect(rows[2]!.classes()).toContain('is-current')
    expect(rows[2]!.attributes('aria-selected')).toBe('true')
  })

  it('reports clicks on cells, double clicks and context menus', async () => {
    const wrapper = mount(Table, { props: { data, columns } })
    const cell = wrapper.findAll('tbody tr')[1]!.findAll('td')[1]!
    await cell.trigger('click')
    await cell.trigger('dblclick')
    await cell.trigger('contextmenu')
    const [row, column] = wrapper.emitted('cellClick')![0] as [Row, TableColumn<Row>]
    expect(row.id).toBe(2)
    expect(column.key).toBe('cpu')
    expect((wrapper.emitted('rowDblclick')![0] as [Row])[0].id).toBe(2)
    expect((wrapper.emitted('rowContextmenu')![0] as [Row, number])[1]).toBe(1)
  })

  it('loads the children of a tree row the first time it opens', async () => {
    let resolve!: (rows: Row[]) => void
    const load = () => new Promise<Row[]>((done) => (resolve = done))
    const wrapper = mount(Table, {
      props: {
        data: [{ id: 9, name: 'group', region: '', cpu: 0, memory: 0, hasChildren: true }],
        columns,
        load,
        'onUpdate:expanded': (keys: unknown) => wrapper.setProps({ expanded: keys as never }),
      },
    })
    const toggle = wrapper.get('.dou-table__toggle')
    await toggle.trigger('click')
    expect(toggle.classes()).toContain('is-loading')
    resolve([data[0]!])
    await flushPromises()
    expect(wrapper.props('expanded')).toEqual([9])
    expect(bodyText(wrapper).map((row) => row[0])).toEqual(['group', 'edge-fn-sh'])
  })

  it('closes a tree row again when loading fails', async () => {
    const wrapper = mount(Table, {
      props: {
        data: [{ id: 9, name: 'group', region: '', cpu: 0, memory: 0, hasChildren: true }],
        columns,
        load: () => Promise.reject(new Error('offline')),
      },
    })
    await wrapper.get('.dou-table__toggle').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('loadError')).toHaveLength(1)
    expect(wrapper.emitted('update:expanded')).toBeUndefined()
    expect(wrapper.get('.dou-table__toggle').classes()).not.toContain('is-loading')
  })

  it('exposes selection, expansion, sort and filter helpers', async () => {
    const tree = [{ id: 9, name: 'group', region: '', cpu: 0, memory: 0, children: data }]
    const wrapper = mount(Table, {
      props: {
        data: tree,
        columns,
        selectable: true,
        sort: { key: 'name', order: 'asc' },
        filters: { region: ['上海'] },
        'onUpdate:selected': (keys: unknown) => wrapper.setProps({ selected: keys as never }),
        'onUpdate:expanded': (keys: unknown) => wrapper.setProps({ expanded: keys as never }),
        'onUpdate:sort': (sort: unknown) => wrapper.setProps({ sort: sort as never }),
        'onUpdate:filters': (filters: unknown) => wrapper.setProps({ filters: filters as never }),
      },
    })
    const table = wrapper.vm as unknown as TableExpose
    table.toggleRowSelection(2)
    table.toggleRowSelection(3, true)
    table.toggleRowSelection(2)
    await nextTick()
    expect(wrapper.props('selected')).toEqual([3])
    table.clearSelection()
    table.toggleRowExpansion(9)
    table.clearSort()
    table.clearFilters('region')
    await nextTick()
    expect(wrapper.props('selected')).toEqual([])
    expect(wrapper.props('expanded')).toEqual([9])
    expect(wrapper.props('sort')).toBeNull()
    expect(wrapper.props('filters')).toEqual({})
    // scrolling to a row in a closed branch opens the branch
    table.toggleRowExpansion(9, false)
    await nextTick()
    table.scrollToRow(3)
    await nextTick()
    expect(wrapper.props('expanded')).toEqual([9])
  })
})
