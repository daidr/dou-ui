import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { SheetValidation, SheetWorkbook } from '../core/model'
import { SheetTransaction } from '../core/transaction'
import { ruleMessage, SheetChecks } from '../core/validation'
import { SheetFormulaEngine } from '../formula'
import { DouSheet } from '../index'
import { sheetLocales } from '../locale'
import type { SheetExpose } from '../types'

const m = sheetLocales['zh-CN']!

function checksOf(cells: unknown[][], rules: SheetValidation[]) {
  const book = { sheets: [{ name: '表', cells }] } as SheetWorkbook
  const engine = new SheetFormulaEngine(book)
  return new SheetChecks(rules, {
    valueAt: (row, col) => engine.result(0, row, col),
    textAt: (row, col) => String(engine.result(0, row, col) ?? ''),
    evaluate: (formula) => engine.evaluate(formula, 0),
    listAt: () => ['上海', '杭州'],
    size: { rows: 100, cols: 26 },
  })
}

describe('validation rules', () => {
  it('checks lists, conditions and formulas; blanks always fit', () => {
    const c = checksOf(
      [
        ['上海', 3, 4.5, 'x'],
        ['南京', 9, 2, 'x'],
      ],
      [
        { range: 'A1:A2', list: '=$H$1:$H$2' },
        { range: 'B1:B2', when: { op: 'between', value: 1, to: 5 } },
        { range: 'C1:C2', when: { op: 'ge', value: 0 }, integer: true },
        { range: 'D1:D2', formula: '=COUNTIF($D$1:$D$2, D1) = 1' },
      ],
    )
    expect(c.brokenAt(0, 0)).toBeUndefined()
    expect(c.fits(0, 0, 'SHANGHAI', '')).toBe(false)
    expect(c.fits(0, 0, '杭州', '杭州')).toBe(true)
    expect(c.brokenAt(1, 0)).toBeDefined()
    expect(c.brokenAt(0, 1)).toBeUndefined()
    expect(c.brokenAt(1, 1)).toBeDefined()
    expect(c.fits(0, 1, '3', '3')).toBe(false)
    expect(c.brokenAt(0, 2)).toBeDefined()
    expect(c.brokenAt(1, 2)).toBeUndefined()
    expect(c.brokenAt(0, 3)).toBeDefined()
    expect(c.fits(0, 1, null, '')).toBe(true)
    expect([...c.broken()].map(({ row, col }) => [row, col])).toEqual([
      [1, 0],
      [1, 1],
      [0, 2],
      [0, 3],
      [1, 3],
    ])
  })

  it('says a rule in words', () => {
    expect(ruleMessage({ range: 'A1', list: ['甲'] }, m)).toBe('请从列表中选择')
    expect(ruleMessage({ range: 'A1', when: { op: 'between', value: 1, to: 5 } }, m)).toBe(
      '请输入数字，介于 1 和 5 之间',
    )
    expect(ruleMessage({ range: 'A1', when: { op: 'notBlank' }, integer: true }, m)).toBe(
      '请输入整数',
    )
    expect(ruleMessage({ range: 'A1', when: { op: 'contains', value: '店' } }, m)).toBe(
      '值应包含 店',
    )
    expect(ruleMessage({ range: 'A1', formula: '=A1>0', message: '要大于零' }, m)).toBe('要大于零')
  })

  it('moves with rows, and its list reference with the cells it reads', () => {
    const tr = new SheetTransaction({
      version: 1,
      sheets: [{ name: '表', cells: [[1], [2], [3]] }],
    })
      .addValidation({ range: 'A2:A3', list: '=$C$1:$C$3' })
      .addValidation({ range: 'B2', formula: '=B2>A2' })
      .insertRows(0, 1)
    expect(tr.doc.sheets[0]!.validations).toEqual([
      { range: 'A3:A4', list: '=$C$2:$C$4' },
      { range: 'B3', formula: '=B3>A3' },
    ])
    tr.clearValidations('B3')
    expect(tr.doc.sheets[0]!.validations).toHaveLength(1)
    tr.clearValidations()
    expect(tr.doc.sheets[0]!.validations).toBeUndefined()
  })
})

describe('rules over several ranges', () => {
  it('checks every range, and moves or drops each one with its cells', () => {
    const c = checksOf(
      [
        [-1, 0, 5],
        [2, 0, -3],
      ],
      [{ range: ['A1:A2', 'C1:C2'], when: { op: 'ge', value: 0 } }],
    )
    expect([...c.broken()].map(({ row, col }) => [row, col])).toEqual([
      [0, 0],
      [1, 2],
    ])
    expect(c.ruleAt(0, 1)).toBeUndefined()

    const tr = new SheetTransaction({ version: 1, sheets: [{ name: '表', cells: [[1, 2, 3]] }] })
      .addValidation({ range: ['A1:A9', 'C1:C9'], when: { op: 'ge', value: 0 } })
      .insertCols(1, 1)
    expect(tr.doc.sheets[0]!.validations![0]!.range).toEqual(['A1:A9', 'D1:D9'])
    tr.deleteCols(0, 1)
    expect(tr.doc.sheets[0]!.validations![0]!.range).toEqual(['C1:C9'])
    expect(() => tr.addValidation({ range: ['A1', 'nope'], list: [] })).toThrow(
      '"nope" isn\'t a range',
    )
  })
})

function setup() {
  const doc = ref<SheetWorkbook>({
    version: 1,
    sheets: [
      {
        name: '表',
        cells: [
          ['上海', 3],
          ['南京', 4],
        ],
        validations: [
          {
            range: 'A1:A3',
            list: [{ value: '上海', tone: 'primary' }, '杭州'],
            prompt: '选一个城市',
          },
          { range: 'B1:B3', when: { op: 'between', value: 1, to: 5 }, integer: true },
        ],
      },
    ],
  })
  const grid = ref<SheetExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouSheet, {
          ref: grid,
          modelValue: doc.value,
          'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
        }),
    ),
    { attachTo: document.body },
  )
  const cell = (row: number, col: number) =>
    wrapper.find(`[role=row][aria-rowindex="${row + 2}"] [aria-colindex="${col + 2}"]`)
  return { doc, grid, wrapper, cell }
}

describe('DouSheet with validation', () => {
  it('marks values that break a rule and lists them', async () => {
    const { grid, wrapper, cell } = setup()
    await nextTick()
    expect(cell(1, 0).classes()).toContain('is-invalid')
    expect(cell(1, 0).attributes('title')).toBe('请从列表中选择')
    expect(cell(1, 0).attributes('aria-invalid')).toBe('true')
    expect(cell(0, 0).attributes('aria-invalid')).toBeUndefined()
    expect(cell(0, 0).classes()).not.toContain('is-invalid')
    expect(grid.value!.findInvalid()).toEqual([
      expect.objectContaining({ sheet: '表', cell: 'A2', message: '请从列表中选择' }),
    ])
    wrapper.unmount()
  })

  it('shows options with a tone as tags', async () => {
    const { wrapper, cell } = setup()
    await nextTick()
    expect(cell(0, 0).find('.dou-sheet__tag').classes()).toContain('dou-tag--primary')
    // a value outside the list stays plain text
    expect(cell(1, 0).find('.dou-sheet__tag').exists()).toBe(false)
    wrapper.unmount()
  })

  it('takes Alt + ↓ on any cell, so the page does not scroll', async () => {
    const { wrapper, grid } = setup()
    await nextTick()
    grid.value!.select('B1') // not a list
    await nextTick()
    const press = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      altKey: true,
      bubbles: true,
      cancelable: true,
    })
    wrapper.find('textarea').element.dispatchEvent(press)
    expect(press.defaultPrevented).toBe(true)
    wrapper.unmount()
  })

  it('refuses a typed value that breaks a strict rule, and keeps the edit open', async () => {
    const { doc, grid, wrapper } = setup()
    await nextTick()
    grid.value!.edit('B1')
    await nextTick()
    const editor = wrapper.find('textarea')
    await editor.setValue('9')
    await editor.trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(doc.value.sheets[0]!.cells[0]![1]).toBe(3)
    expect(wrapper.find('.dou-sheet__notice').text()).toContain('请输入整数，介于 1 和 5 之间')
    expect(wrapper.find('.dou-sheet').classes()).toContain('is-editing')
    await editor.setValue('5')
    await editor.trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(doc.value.sheets[0]!.cells[0]![1]).toBe(5)
    wrapper.unmount()
  })
})
