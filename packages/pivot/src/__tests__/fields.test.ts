import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouPivot, DouPivotFields, type PivotConfig } from '../index'
import {
  areasOf,
  configOf,
  moveItem,
  stepsFor,
  withAggregate,
  withDimension,
  withFilter,
} from '../fields/model'

const sales = [
  { region: '华东', city: '上海', amount: 10 },
  { region: '华东', city: '杭州', amount: 5 },
  { region: '华南', city: '广州', amount: 7 },
]

describe('fields model', () => {
  it('reads the areas from a config, keeping a filtered axis field on its axis', () => {
    const areas = areasOf({
      rows: ['region'],
      columns: [{ field: 'city', sort: 'desc' }],
      values: ['amount'],
      filters: { region: { exclude: ['华南'] }, channel: {} },
    })
    expect(areas.rows.map((i) => i.field)).toEqual(['region'])
    expect(areas.columns.map((i) => i.field)).toEqual(['city'])
    expect(areas.values.map((i) => i.field)).toEqual(['amount'])
    expect(areas.filters.map((i) => i.field)).toEqual(['channel'])
  })

  it('moves a field with its options and filter, and a field from the list wins', () => {
    const config: PivotConfig = {
      rows: [{ field: 'region', sort: 'desc' }],
      values: ['amount'],
      filters: { region: { exclude: ['华南'] } },
    }
    const areas = areasOf(config)
    const moved = configOf(moveItem(areas, 'rows', areas.rows[0]!, 'columns'), config)
    expect(moved.rows).toEqual([])
    expect(moved.columns).toEqual([{ field: 'region', sort: 'desc' }])
    expect(moved.filters).toEqual({ region: { exclude: ['华南'] } })

    // dragging region from the list into the rows again: one region only
    const fresh = { key: 'f', kind: 'field' as const, field: 'region', index: 0 }
    const again = configOf({ ...areas, rows: [...areas.rows, fresh] }, config)
    expect(again.rows).toEqual([{ field: 'region', sort: 'desc' }])

    // out of every area: its filter goes too
    const removed = configOf(moveItem(areas, 'rows', areas.rows[0]!, null), config)
    expect(removed.filters).toBeUndefined()
  })

  it('drops the sort when its value or the columns go away', () => {
    const config: PivotConfig = {
      rows: ['region'],
      columns: ['city'],
      values: ['amount'],
      sort: { valueIndex: 0, column: ['上海'], order: 'desc' },
    }
    const areas = areasOf(config)
    expect(configOf(areas, config).sort).toEqual(config.sort)
    expect(configOf(moveItem(areas, 'columns', areas.columns[0]!, null), config).sort).toBeNull()
  })

  it('changes a dimension and keeps plain names plain', () => {
    const config: PivotConfig = { rows: ['date'], filters: { date: { include: ['2026-Q1'] } } }
    const grouped = withDimension(config, 'rows', 'date', { by: 'month' })
    expect(grouped.rows).toEqual([{ field: 'date', by: 'month' }])
    // a filter on quarters no longer fits months
    expect(grouped.filters).toEqual({ date: {} })
    expect(withDimension(grouped, 'rows', 'date', { by: null }).rows).toEqual(['date'])
    expect(withDimension(config, 'rows', 'date', { subtotal: false }).rows).toEqual([
      { field: 'date', subtotal: false },
    ])
  })

  it('sets aggregates and filters', () => {
    expect(withAggregate({ values: ['amount'] }, 0, 'avg').values).toEqual([
      { field: 'amount', aggregate: 'avg' },
    ])
    const filtered = withFilter({}, 'region', { exclude: ['华南'] }, false)
    expect(filtered.filters).toEqual({ region: { exclude: ['华南'] } })
    expect(withFilter(filtered, 'region', null, false).filters).toBeUndefined()
    expect(withFilter(filtered, 'region', null, true).filters).toEqual({ region: {} })
  })

  it('offers round range sizes', () => {
    expect(stepsFor(0, 1000)).toEqual([50, 100, 200])
    expect(stepsFor(3, 3)).toEqual([])
  })
})

describe('DouPivotFields', () => {
  it('adds a field when its box is checked, and the table follows', async () => {
    const config = ref<PivotConfig>({ rows: ['region'], values: ['amount'] })
    const wrapper = mount(
      defineComponent(
        () => () =>
          h('div', [
            h(DouPivotFields, {
              data: sales,
              drawer: false,
              config: config.value,
              'onUpdate:config': (value: PivotConfig) => (config.value = value),
            }),
            h(DouPivot, { data: sales, config: config.value }),
          ]),
      ),
      { attachTo: document.body },
    )
    const box = wrapper
      .findAll('.dou-pivot-fields__field')
      .find((el) => el.text().includes('city'))!
      .find('input')
    await box.setValue(true)
    await nextTick()
    await Promise.resolve()
    expect(config.value.rows).toEqual(['region', 'city'])
    await nextTick()
    expect(wrapper.findAll('.dou-pivot__body .dou-pivot__row-head').length).toBeGreaterThan(3)

    await box.setValue(false)
    await Promise.resolve()
    expect(config.value.rows).toEqual(['region'])
    wrapper.unmount()
  })
})

describe('tabular layout', () => {
  it('puts each row field in its own column and subtotals after the children', async () => {
    const wrapper = mount(DouPivot, {
      props: {
        data: sales,
        config: { rows: ['region', 'city'], values: ['amount'] },
        layout: 'tabular',
      },
      attachTo: document.body,
    })
    await nextTick()
    const rows = wrapper
      .findAll('.dou-pivot__body .dou-pivot__row-head')
      .map((el) => el.findAll('.dou-pivot__level').map((l) => l.text()))
    expect(rows).toEqual([
      ['华东', '杭州'],
      ['', '上海'],
      ['华东 小计', ''],
      ['华南', '广州'],
      ['华南 小计', ''],
    ])
    wrapper.unmount()
  })
})
