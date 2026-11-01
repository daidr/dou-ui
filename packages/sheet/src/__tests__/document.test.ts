import { describe, expect, it, vi } from 'vitest'
import { readWorkbook } from '../core/document'
import { checkWorkbook, defineSheetCellType, defineSheetExtension, migrateWorkbook } from '..'
import type { SheetWorkbook } from '..'

const book = (): SheetWorkbook => ({
  version: 1,
  styles: { head: { bold: true } },
  types: { status: { type: 'select', options: ['未开始', '已完成'] } },
  sheets: [
    {
      name: '订单',
      cells: [
        [
          { value: '客户', style: 'head' },
          { value: '状态', style: 'head' },
        ],
        ['戴兜', { value: '未开始', type: 'status' }, { value: true, type: 'checkbox' }],
      ],
      merges: ['A3:B3'],
    },
    { id: 's2', name: '汇总', cells: [] },
  ],
})

describe('checkWorkbook', () => {
  it('finds nothing in a good workbook', () => {
    expect(checkWorkbook(book())).toEqual([])
  })

  it('finds the version, names, ids, styles, types and merges', () => {
    const value = book() as unknown as Record<string, any>
    value.version = 3
    value.types.rating = { type: 'stars' }
    value.sheets[0].cells[1][2] = { value: 1, type: 'rating', style: 'warn' }
    value.sheets[0].merges = ['A3:B3', 'B3:C4', 'nope']
    value.sheets.push({ id: 's2', name: '汇总', cells: [] }, { name: '', cells: [] })
    const problems = checkWorkbook(value as SheetWorkbook)
    expect(problems.map((p) => [p.code, p.path, p.text])).toEqual([
      ['version', 'version', '3'],
      ['unknown-type', 'types.rating', 'stars'],
      ['unknown-style', 'sheets[0].cells[1][2]', 'warn'],
      ['bad-merge', 'sheets[0].merges[1]', 'B3:C4'],
      ['bad-merge', 'sheets[0].merges[2]', 'nope'],
      ['duplicate-name', 'sheets[2]', '汇总'],
      ['duplicate-id', 'sheets[2]', 's2'],
      ['missing-name', 'sheets[3]', ''],
    ])
    expect(problems[2]!.sheet).toBe('订单')
  })

  it('knows the cell types extensions add', () => {
    const value = book()
    value.sheets[1]!.cells = [[{ value: 4, type: 'stars' }]]
    expect(checkWorkbook(value).map((p) => p.code)).toEqual(['unknown-type'])
    const stars = defineSheetCellType({ name: 'stars' })
    const extension = defineSheetExtension({ name: 'stars', cellTypes: [stars] })
    expect(checkWorkbook(value, { extensions: [extension] })).toEqual([])
  })

  it('reports a workbook of the wrong shape and nothing else', () => {
    expect(checkWorkbook('x' as unknown as SheetWorkbook).map((p) => p.code)).toEqual(['shape'])
    const value = { version: 1, sheets: null } as unknown as SheetWorkbook
    expect(checkWorkbook(value).map((p) => p.path)).toEqual(['sheets'])
  })
})

describe('migrateWorkbook', () => {
  it('fills what is missing and keeps the rest', () => {
    expect(
      migrateWorkbook({ sheets: [{ name: '表' }, 'x'], styles: { a: { bold: true } } }),
    ).toEqual({ version: 1, sheets: [{ name: '表', cells: [] }], styles: { a: { bold: true } } })
  })

  it('throws for data that is not an object', () => {
    for (const input of [null, undefined, 'x', [{ id: 'a' }]])
      expect(() => migrateWorkbook(input)).toThrow('[@dou-ui/sheet]')
  })

  it('throws for a version it does not know', () => {
    expect(() => migrateWorkbook({ version: 2, sheets: [] })).toThrow('version 2')
    expect(() => migrateWorkbook({ version: '1' })).toThrow('version "1"')
  })
})

describe('readWorkbook', () => {
  it('reads a wrongly shaped v-model with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const good = book()
    expect(readWorkbook(good)).toBe(good)
    expect(readWorkbook({ version: 3, sheets: good.sheets })).toEqual({
      version: 1,
      sheets: good.sheets,
    })
    expect(warn.mock.calls[0]![0]).toContain('[@dou-ui/sheet] the v-model has version 3')
    warn.mockRestore()
  })
})
