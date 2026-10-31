import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { layStyle, SheetLooks, type SheetLookSource } from '../core/conditional'
import type { SheetConditionalFormat, SheetWorkbook } from '../core/model'
import { SheetTransaction } from '../core/transaction'
import { SheetFormulaEngine } from '../formula'
import { DouSheet } from '../index'
import type { SheetExpose } from '../types'

/** Looks over a grid of plain values, formulas worked out by an engine. */
function looksOf(cells: unknown[][], formats: SheetConditionalFormat[]) {
  const book = { sheets: [{ name: '表', cells }] } as SheetWorkbook
  const engine = new SheetFormulaEngine(book)
  const source: SheetLookSource = {
    valueAt: (row, col) => engine.result(0, row, col),
    textAt: (row, col) => String(engine.result(0, row, col) ?? ''),
    evaluate: (formula) => engine.evaluate(formula, 0),
    styles: { warn: { fill: 'warning' } },
    size: { rows: 100, cols: 26 },
  }
  return new SheetLooks(formats, source)
}

const column = (values: unknown[]) => values.map((v) => [v])

describe('conditional formats', () => {
  it('styles cells that meet a condition, including between', () => {
    const looks = looksOf(column([5, 12, 20, null]), [
      { range: 'A1:A4', when: { op: 'between', value: 10, to: 15 }, style: { tone: 'danger' } },
      { range: 'A1:A4', when: { op: 'blank' }, style: 'warn' },
    ])
    expect(looks.lookAt(0, 0)).toBeUndefined()
    expect(looks.lookAt(1, 0)?.style).toEqual({ tone: 'danger' })
    expect(looks.lookAt(3, 0)?.style).toEqual({ fill: 'warning' })
  })

  it('moves a formula with each cell, keeping $ references', () => {
    const looks = looksOf(
      [
        [10, 8],
        [10, 12],
      ],
      [{ range: 'A1:B2', formula: '=$B1>$A1', style: { bold: true } }],
    )
    expect(looks.lookAt(0, 0)).toBeUndefined()
    expect(looks.lookAt(1, 0)?.style).toEqual({ bold: true })
    expect(looks.lookAt(1, 1)?.style).toEqual({ bold: true })
  })

  it('finds the top and bottom numbers, by count or percent', () => {
    const values = column([3, 9, 1, 7, 5, 'x'])
    const top = looksOf(values, [{ range: 'A1:A6', top: 2, style: { bold: true } }])
    expect([0, 1, 2, 3, 4, 5].map((r) => !!top.lookAt(r, 0))).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
    ])
    const bottom = looksOf(values, [
      { range: 'A1:A6', bottom: 20, percent: true, style: { bold: true } },
    ])
    expect([0, 1, 2, 3, 4].map((r) => !!bottom.lookAt(r, 0))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ])
  })

  it('compares with the average and finds repeated values without case', () => {
    const avg = looksOf(column([1, 2, 6]), [
      { range: 'A1:A3', average: 'above', style: { bold: true } },
    ])
    expect([0, 1, 2].map((r) => !!avg.lookAt(r, 0))).toEqual([false, false, true])
    const dup = looksOf(column(['上海', 'abc', 'ABC', '', null]), [
      { range: 'A1:A5', duplicates: true, style: { bold: true } },
    ])
    expect([0, 1, 2, 3, 4].map((r) => !!dup.lookAt(r, 0))).toEqual([
      false,
      true,
      true,
      false,
      false,
    ])
  })

  it('shades numbers along a scale and draws bars from zero', () => {
    const looks = looksOf(column([0, 50, 100, -50]), [
      { range: 'A1:A3', scale: ['#000000', '#ffffff'] },
      { range: 'A1:A4', bar: 'primary' },
    ])
    expect(looks.lookAt(0, 0)?.style?.background).toBe('#000000')
    expect(looks.lookAt(1, 0)?.style?.background).toBe('color-mix(in oklab, #ffffff 50%, #000000)')
    expect(looks.lookAt(2, 0)?.style?.background).toBe('#ffffff')
    const third = 1 / 3
    expect(looks.lookAt(1, 0)?.bar).toMatchObject({ from: third, to: 2 * third })
    expect(looks.lookAt(3, 0)?.bar).toMatchObject({ from: 0, to: third })
    expect(looks.lookAt(3, 0)?.bar?.color).toContain('danger')
  })

  it('lets earlier formats win, and the look win over the cell’s own style', () => {
    const looks = looksOf(column([9]), [
      { range: 'A1', when: { op: 'gt', value: 1 }, style: { tone: 'danger' } },
      { range: 'A1', when: { op: 'gt', value: 1 }, style: { color: '#123456', bold: true } },
    ])
    expect(looks.lookAt(0, 0)?.style).toEqual({ tone: 'danger', bold: true })
    expect(layStyle({ color: 'red', italic: true }, { tone: 'success' })).toEqual({
      tone: 'success',
      italic: true,
    })
  })
})

const book = (): SheetWorkbook => ({ sheets: [{ name: '表', cells: [[1], [2], [3]] }] })

describe('reading a range again', () => {
  it('keeps what a rule read while the range’s rows stay the same', () => {
    const rows = [[1], [5], [3]]
    let reads = 0
    const source = (): SheetLookSource => ({
      valueAt: (row) => (reads++, rows[row]![0]),
      textAt: (row) => String(rows[row]![0]),
      evaluate: () => null,
      cellStamp: (row) => rows[row],
      size: { rows: 3, cols: 1 },
    })
    const formats: SheetConditionalFormat[] = [{ range: 'A1:A3', top: 1, style: { bold: true } }]
    const first = new SheetLooks(formats, source())
    expect(first.lookAt(1, 0)?.style).toEqual({ bold: true })
    const read = reads
    // another sheet changed: same rows, so the top value isn't read again
    const second = new SheetLooks(formats, source(), first)
    expect(second.lookAt(1, 0)?.style).toEqual({ bold: true })
    expect(reads - read).toBe(1)
    // a row's result changed: read again
    rows[2] = [9]
    const third = new SheetLooks(formats, source(), second)
    expect(third.lookAt(1, 0)).toBeUndefined()
    expect(third.lookAt(2, 0)?.style).toEqual({ bold: true })
  })
})

describe('conditional formats in transactions', () => {
  it('adds, sets and clears formats', () => {
    const tr = new SheetTransaction(book())
      .addConditionalFormat({ range: 'A1:A3', bar: true })
      .addConditionalFormat({ range: 'B1', when: { op: 'blank' }, style: { bold: true } })
    expect(tr.doc.sheets[0]!.conditionalFormats).toHaveLength(2)
    tr.clearConditionalFormats('A2')
    expect(tr.doc.sheets[0]!.conditionalFormats).toEqual([
      { range: 'B1', when: { op: 'blank' }, style: { bold: true } },
    ])
    tr.clearConditionalFormats()
    expect(tr.doc.sheets[0]!.conditionalFormats).toBeUndefined()
    expect(() => tr.addConditionalFormat({ range: 'nope', bar: true })).toThrow("isn't a range")
  })

  it('moves ranges and formulas with inserted and deleted rows', () => {
    const tr = new SheetTransaction(book())
      .addConditionalFormat({ range: 'A2:A3', formula: '=A2>$A$1', style: { bold: true } })
      .addConditionalFormat({ range: 'A1', bar: true })
      .insertRows(0, 2)
    expect(tr.doc.sheets[0]!.conditionalFormats).toEqual([
      { range: 'A4:A5', formula: '=A4>$A$3', style: { bold: true } },
      { range: 'A3', bar: true },
    ])
    tr.deleteRows('3')
    expect(tr.doc.sheets[0]!.conditionalFormats).toEqual([
      { range: 'A3:A4', formula: '=A3>#REF!', style: { bold: true } },
    ])
  })
})

describe('DouSheet with conditional formats', () => {
  it('draws looks, and redraws a row when a rule looks past it', async () => {
    const doc = ref<SheetWorkbook>({
      sheets: [
        {
          name: '表',
          cells: [[5], [9], [-2]],
          conditionalFormats: [
            { range: 'A1:A3', top: 1, style: { fill: 'danger' } },
            { range: 'A1:A3', bar: 'primary' },
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
    await nextTick()
    const cell = (row: number) =>
      wrapper.find(`[role=row][aria-rowindex="${row + 2}"] [aria-colindex="2"]`)
    expect(cell(1).classes()).toContain('is-fill-danger')
    expect(cell(0).classes()).not.toContain('is-fill-danger')
    expect(cell(0).classes()).toContain('has-bar')
    expect(cell(2).attributes('style')).toContain('danger')
    // only row 0 changes, yet row 1 is no longer the largest
    grid.value!.transact((tr) => tr.setValue('A1', 20))
    await nextTick()
    expect(cell(0).classes()).toContain('is-fill-danger')
    expect(cell(1).classes()).not.toContain('is-fill-danger')
    wrapper.unmount()
  })
})
