import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  applySheetSteps,
  defineSheetExtension,
  DouSheet,
  sheetToCSV,
  SheetTransaction,
  type SheetExpose,
  type SheetExtension,
  type SheetWorkbook,
} from '../index'
import {
  defineSheetFunction,
  isSheetError,
  numbersOf,
  scalarOf,
  toNumber,
  parseFormula,
  SheetError,
  SheetFormulaEngine,
  SheetFormulaSyntaxError,
  type SheetResult,
} from '../formula'

/** Works out one formula over some cells of a sheet named 表1. */
function calc(formula: string, cells: SheetWorkbook['sheets'][number]['cells'] = []) {
  const engine = new SheetFormulaEngine(
    { sheets: [{ name: '表1', cells }] },
    {
      now: () => new Date(2026, 9, 31, 9, 30),
    },
  )
  return show(engine.evaluate(formula))
}

const show = (value: SheetResult) => (value instanceof SheetError ? value.code : value)

describe('parseFormula', () => {
  it('reads operators by precedence', () => {
    expect(calc('=1+2*3')).toBe(7)
    expect(calc('=(1+2)*3')).toBe(9)
    expect(calc('=2^3^2')).toBe(64)
    expect(calc('=-2^2')).toBe(4)
    expect(calc('=50%*4')).toBe(2)
    expect(calc('="a"&1+1')).toBe('a2')
    expect(calc('=1+1=2')).toBe(true)
    expect(calc('=1<2')).toBe(true)
    expect(calc('="b">"A"')).toBe(true)
  })

  it('reads references of every kind', () => {
    expect(parseFormula('=$B$3')).toEqual({
      type: 'ref',
      top: 2,
      left: 1,
      bottom: 2,
      right: 1,
      cell: true,
    })
    expect(parseFormula('=A1:C4')).toMatchObject({
      top: 0,
      left: 0,
      bottom: 3,
      right: 2,
      cell: false,
    })
    expect(parseFormula('=B:D')).toMatchObject({ top: 0, left: 1, bottom: Infinity, right: 3 })
    expect(parseFormula('=2:3')).toMatchObject({ top: 1, left: 0, bottom: 2, right: Infinity })
    expect(parseFormula("='表 2'!A1")).toMatchObject({ sheet: '表 2', top: 0, left: 0 })
    expect(parseFormula('=表2!A1:A2')).toMatchObject({ sheet: '表2', bottom: 1 })
  })

  it('tells text that isn’t a formula', () => {
    expect(() => parseFormula('=1+')).toThrow(SheetFormulaSyntaxError)
    expect(() => parseFormula('=SUM(1')).toThrow(SheetFormulaSyntaxError)
    expect(() => parseFormula('="open')).toThrow(SheetFormulaSyntaxError)
    expect(calc('=(1')).toBe('#ERROR!')
    // unknown names are #NAME?, not a mistake in the text
    expect(calc('=foo')).toBe('#NAME?')
    expect(calc('=NOPE(1)')).toBe('#NAME?')
  })
})

describe('values', () => {
  it('reads cells as numbers where it can', () => {
    const cells = [[1, '2', true, null, '上海', '1,280', "'=x"]]
    expect(calc('=A1+B1', cells)).toBe(3)
    expect(calc('=A1+C1', cells)).toBe(2)
    expect(calc('=D1+1', cells)).toBe(1)
    expect(calc('=E1+1', cells)).toBe('#VALUE!')
    expect(calc('=F1*2', cells)).toBe(2560)
    expect(calc('=G1', cells)).toBe('=x')
    // an empty cell shows 0
    expect(calc('=D1', cells)).toBe(0)
  })

  it('counts dates in days, keeping them dates', () => {
    const cells = [['2026-03-05', '2026-03-01']]
    expect(calc('=A1+30', cells)).toBe('2026-04-04')
    expect(calc('=A1-B1', cells)).toBe(4)
    expect(calc('=A1-4', cells)).toBe('2026-03-01')
    expect(calc('=A1>B1', cells)).toBe(true)
  })

  it('gives errors and passes them on', () => {
    expect(calc('=1/0')).toBe('#DIV/0!')
    expect(calc('=(1/0)+1')).toBe('#DIV/0!')
    expect(calc('=SQRT(-1)')).toBe('#NUM!')
    expect(calc('=A1:A2+1', [[1], [2]])).toBe('#VALUE!')
    expect(calc('=表9!A1')).toBe('#REF!')
    expect(calc('=#N/A')).toBe('#N/A')
  })

  it('rounds the way people do, without float noise', () => {
    expect(calc('=0.1+0.2')).toBeCloseTo(0.3)
    expect(calc('=ROUND(1.005,2)')).toBe(1.01)
    expect(calc('=ROUND(-2.5,0)')).toBe(-3)
    expect(calc('=ROUNDUP(1.21,1)')).toBe(1.3)
    expect(calc('=ROUNDDOWN(-1.29,1)')).toBe(-1.2)
    expect(calc('=ROUND(1234,-2)')).toBe(1200)
  })
})

describe('functions', () => {
  const sales = [
    ['城市', '产品', '金额', '日期'],
    ['上海', '咖啡', 120, '2026-01-05'],
    ['上海', '茶', 80, '2026-02-10'],
    ['杭州', '咖啡', 60, '2026-02-12'],
    ['苏州', '果汁', null, '2026-03-01'],
    ['上海', '咖啡', 40, '2026-03-02'],
  ]

  it('sums, counts and averages', () => {
    expect(calc('=SUM(C2:C6)', sales)).toBe(300)
    expect(calc('=SUM(C:C)', sales)).toBe(300)
    expect(calc('=SUM(1,"2",TRUE)')).toBe(4)
    expect(calc('=AVERAGE(C2:C6)', sales)).toBe(75)
    expect(calc('=COUNT(C1:C6)', sales)).toBe(4)
    expect(calc('=COUNTA(C1:C6)', sales)).toBe(5)
    expect(calc('=COUNTBLANK(C1:C6)', sales)).toBe(1)
    expect(calc('=MAX(C2:C6)-MIN(C2:C6)', sales)).toBe(80)
    expect(calc('=AVERAGE(D9:D10)', sales)).toBe('#DIV/0!')
  })

  it('picks with conditions', () => {
    expect(calc('=IF(C2>100,"高","低")', sales)).toBe('高')
    expect(calc('=IF(FALSE,1)')).toBe(false)
    expect(calc('=IFS(C3>100,"高",C3>50,"中",TRUE,"低")', sales)).toBe('中')
    expect(calc('=IFERROR(1/0,"无")')).toBe('无')
    expect(calc('=AND(C2>0,C3>0)', sales)).toBe(true)
    expect(calc('=OR(C2>200,C3>200)', sales)).toBe(false)
    expect(calc('=NOT(ISBLANK(C5))', sales)).toBe(false)
    // only the branch taken is worked out
    expect(calc('=IF(TRUE,1,1/0)')).toBe(1)
  })

  it('sums and counts what meets conditions', () => {
    expect(calc('=SUMIF(A2:A6,"上海",C2:C6)', sales)).toBe(240)
    expect(calc('=SUMIF(C2:C6,">=80")', sales)).toBe(200)
    expect(calc('=COUNTIF(B2:B6,"咖*")', sales)).toBe(3)
    expect(calc('=COUNTIF(B2:B6,"<>咖啡")', sales)).toBe(2)
    expect(calc('=COUNTIF(C2:C6,"")', sales)).toBe(1)
    expect(calc('=AVERAGEIF(A2:A6,"上海",C2:C6)', sales)).toBe(80)
    expect(calc('=SUMIFS(C2:C6,A2:A6,"上海",B2:B6,"咖啡")', sales)).toBe(160)
    expect(calc('=COUNTIFS(A2:A6,"上海",D2:D6,">=2026-02-01")', sales)).toBe(2)
    expect(calc('=SUMIFS(C2:C6,A2:A5,"上海")', sales)).toBe('#VALUE!')
  })

  it('looks things up', () => {
    const table = [
      [0, '不及格'],
      [60, '及格'],
      [80, '良好'],
      [90, '优秀'],
    ]
    expect(calc('=VLOOKUP(85,A1:B4,2)', table)).toBe('良好')
    expect(calc('=VLOOKUP(60,A1:B4,2,FALSE)', table)).toBe('及格')
    expect(calc('=VLOOKUP(61,A1:B4,2,FALSE)', table)).toBe('#N/A')
    expect(calc('=VLOOKUP(61,A1:B4,3,FALSE)', table)).toBe('#REF!')
    expect(calc('=INDEX(A1:B4,3,2)', table)).toBe('良好')
    expect(calc('=MATCH(80,A1:A4,0)', table)).toBe(3)
    expect(calc('=MATCH(85,A1:A4)', table)).toBe(3)
    expect(calc('=XLOOKUP("良好",B1:B4,A1:A4)', table)).toBe(80)
    expect(calc('=XLOOKUP("满分",B1:B4,A1:A4,"无")', table)).toBe('无')
    expect(calc('=XLOOKUP(85,A1:A4,B1:B4,,-1)', table)).toBe('良好')
    expect(calc('=XLOOKUP(85,A1:A4,B1:B4,,1)', table)).toBe('优秀')
    expect(calc('=XLOOKUP("良*",B1:B4,A1:A4,,2)', table)).toBe(80)
  })

  it('works with text', () => {
    expect(calc('=CONCAT("戴","兜")')).toBe('戴兜')
    expect(calc('=TEXTJOIN("、",TRUE,A1:C1)', [['上海', null, '杭州']])).toBe('上海、杭州')
    expect(calc('=LEFT("上海市",2)')).toBe('上海')
    expect(calc('=RIGHT("abc")')).toBe('c')
    expect(calc('=MID("abcdef",2,3)')).toBe('bcd')
    expect(calc('=LEN("戴兜")')).toBe(2)
    expect(calc('=TRIM("  a   b ")')).toBe('a b')
    expect(calc('=UPPER("ab")&LOWER("CD")')).toBe('ABcd')
    expect(calc('=SUBSTITUTE("a-b-c","-","+",2)')).toBe('a-b+c')
    expect(calc('=FIND("b","abc")')).toBe(2)
    expect(calc('=TEXT(1234.5,"#,##0.00")')).toBe('1,234.50')
    expect(calc('=TEXT("2026-03-05","yyyy/mm/dd")')).toBe('2026/03/05')
    expect(calc('=VALUE("12%")')).toBe(0.12)
  })

  it('works with dates', () => {
    expect(calc('=TODAY()')).toBe('2026-10-31')
    expect(calc('=NOW()')).toBe('2026-10-31 09:30')
    expect(calc('=DATE(2026,2,30)')).toBe('2026-03-02')
    expect(calc('=YEAR("2026-03-05")*100+MONTH("2026-03-05")')).toBe(202603)
    expect(calc('=DAY(DATE(2026,12,31))')).toBe(31)
    expect(calc('=WEEKDAY("2026-10-31")')).toBe(7)
    expect(calc('=WEEKDAY("2026-10-31",2)')).toBe(6)
    expect(calc('=DATEDIF("2026-01-31","2026-03-01","M")')).toBe(1)
    expect(calc('=DATEDIF("2026-01-31","2026-03-01","D")')).toBe(29)
    expect(calc('=DATEDIF("2024-02-29","2026-02-28","Y")')).toBe(1)
    expect(calc('=DATEDIF("2026-03-05","2026-01-01","D")')).toBe('#NUM!')
  })

  it('checks how many arguments are given', () => {
    expect(calc('=ROUND()')).toBe('#VALUE!')
    expect(calc('=NOT(1,2)')).toBe('#VALUE!')
  })
})

const book = (): SheetWorkbook => ({
  sheets: [
    {
      name: '明细',
      cells: [
        [10, 20, '=A1+B1'],
        ['=C1*2', '=SUM(A1:A2)', '=汇总!A1'],
      ],
    },
    { id: 'total', name: '汇总', cells: [['=SUM(明细!A1:B1)', '=A1*10']] },
  ],
})

describe('SheetFormulaEngine', () => {
  it('works out results across sheets', () => {
    const engine = new SheetFormulaEngine(book())
    expect(engine.result(0, 1, 1)).toBe(70)
    expect(engine.result(0, 1, 2)).toBe(30)
    expect(engine.result('total', 0, 1)).toBe(300)
    expect(engine.result(0, 0, 0)).toBe(10)
    expect(engine.result(0, 5, 5)).toBe(null)
    // a cell by name or as a point
    expect(engine.result(0, 'B2')).toBe(70)
    expect(engine.result('total', { row: 0, col: 1 })).toBe(300)
    expect(engine.isFormula(0, 'C1')).toBe(true)
    expect(engine.isFormula(0, 0, 0)).toBe(false)
  })

  it('forgets only what depends on a change', () => {
    const before = book()
    const engine = new SheetFormulaEngine(before)
    const rows = [0, 1].map((row) => engine.rowVersion(0, row))
    const totals = engine.rowVersion('total', 0)
    expect(engine.result(0, 1, 1)).toBe(70)
    expect(engine.result('total', 0, 1)).toBe(300)
    const tr = applySheetSteps(before, [
      { type: 'setCell', sheet: '明细', row: 0, col: 1, cell: 5 },
    ])
    engine.update(tr)
    expect(engine.result(0, 0, 2)).toBe(15)
    expect(engine.result(0, 1, 1)).toBe(40)
    expect(engine.result('total', 0, 1)).toBe(150)
    // both rows of the sheet and the other sheet's row changed
    expect(engine.rowVersion(0, 0)).not.toBe(rows[0])
    expect(engine.rowVersion(0, 1)).not.toBe(rows[1])
    expect(engine.rowVersion('total', 0)).not.toBe(totals)
    // a cell nothing refers to touches only its own row
    const quiet = engine.rowVersion(0, 0)
    const next = applySheetSteps(tr.doc, [
      { type: 'setCell', sheet: '明细', row: 3, col: 3, cell: 1 },
    ])
    engine.update(next)
    expect(engine.rowVersion(0, 0)).toBe(quiet)
  })

  it('follows formulas being written and taken out', () => {
    const before = book()
    const engine = new SheetFormulaEngine(before)
    expect(engine.result(0, 0, 2)).toBe(30)
    const tr = applySheetSteps(before, [
      { type: 'setCell', sheet: '明细', row: 0, col: 2, cell: '=A1*3' },
      { type: 'setCell', sheet: '明细', row: 0, col: 0, cell: 2 },
    ])
    engine.update(tr)
    expect(engine.result(0, 0, 2)).toBe(6)
    expect(engine.result(0, 1, 0)).toBe(12)
    const plain = applySheetSteps(tr.doc, [
      { type: 'setCell', sheet: '明细', row: 0, col: 2, cell: 1 },
    ])
    engine.update(plain)
    expect(engine.result(0, 1, 0)).toBe(2)
  })

  it('starts over after rows move, and after a workbook it didn’t see', () => {
    const before = book()
    const engine = new SheetFormulaEngine(before)
    expect(engine.result(0, 1, 1)).toBe(70)
    const tr = new SheetTransaction(before).insertRows(0, 1)
    engine.update(tr)
    // the formulas moved down a row and now point at the rows they moved to
    expect(engine.result(0, 2, 1)).toBe(70)
    const outside: SheetWorkbook = { sheets: [{ name: '新', cells: [[1, '=A1+1']] }] }
    engine.update({ doc: outside, steps: [], before: { sheets: [] } })
    expect(engine.result(0, 0, 1)).toBe(2)
  })

  it('gives #CYCLE! for formulas that depend on themselves', () => {
    const doc: SheetWorkbook = {
      sheets: [{ name: '表', cells: [['=B1', '=A1+1', '=A1', '=D1', 5]] }],
    }
    const engine = new SheetFormulaEngine(doc)
    expect(show(engine.result(0, 0, 0))).toBe('#CYCLE!')
    expect(show(engine.result(0, 0, 1))).toBe('#CYCLE!')
    expect(show(engine.result(0, 0, 2))).toBe('#CYCLE!')
    expect(show(engine.result(0, 0, 3))).toBe('#CYCLE!')
    // breaking the loop works it out again
    const tr = applySheetSteps(doc, [{ type: 'setCell', sheet: '表', row: 0, col: 0, cell: 1 }])
    engine.update(tr)
    expect(engine.result(0, 0, 1)).toBe(2)
    expect(engine.result(0, 0, 2)).toBe(1)
  })

  it('works out long chains without running out of stack', () => {
    const n = 20_000
    const doc: SheetWorkbook = {
      sheets: [
        {
          name: '链',
          rowCount: n,
          cells: Array.from({ length: n }, (_, i) => [i ? `=A${i}+1` : 1]),
        },
      ],
    }
    const engine = new SheetFormulaEngine(doc)
    expect(engine.evaluate('=SUM(A:A)')).toBe((n * (n + 1)) / 2)
    expect(engine.result(0, n - 1, 0)).toBe(n)
    const tr = applySheetSteps(doc, [{ type: 'setCell', sheet: '链', row: 0, col: 0, cell: 100 }])
    engine.update(tr)
    expect(engine.result(0, n - 1, 0)).toBe(n + 99)
  })

  it('works out TODAY() again on every change', () => {
    let day = 1
    const doc: SheetWorkbook = { sheets: [{ name: '表', cells: [['=TODAY()']] }] }
    const engine = new SheetFormulaEngine(doc, { now: () => new Date(2026, 9, day) })
    expect(engine.result(0, 0, 0)).toBe('2026-10-01')
    day = 2
    const tr = applySheetSteps(doc, [{ type: 'setCell', sheet: '表', row: 5, col: 5, cell: 1 }])
    engine.update(tr)
    expect(engine.result(0, 0, 0)).toBe('2026-10-02')
  })

  it('takes functions of its own', () => {
    const TAX = defineSheetFunction({
      name: 'TAX',
      minArgs: 1,
      maxArgs: 1,
      run: (args) => {
        const ns = numbersOf(args)
        return Array.isArray(ns) ? ns[0]! * 0.06 : ns
      },
    })
    const doc: SheetWorkbook = { sheets: [{ name: '表', cells: [[100, '=tax(A1)', '=TAX()']] }] }
    const engine = new SheetFormulaEngine(doc, { functions: [TAX] })
    expect(engine.result(0, 0, 1)).toBeCloseTo(6)
    expect(show(engine.result(0, 0, 2))).toBe('#VALUE!')
    expect(engine.hasFunction('tax')).toBe(true)
  })

  it('takes arguments by position, as the docs show', () => {
    const TAX = defineSheetFunction({
      name: 'TAX',
      minArgs: 1,
      maxArgs: 2,
      run: ([amountArg, rateArg]) => {
        const amount = toNumber(scalarOf(amountArg!))
        const rate = rateArg === undefined ? 0.06 : toNumber(scalarOf(rateArg))
        if (isSheetError(amount)) return amount
        if (isSheetError(rate)) return rate
        return amount * (1 + rate)
      },
    })
    const doc: SheetWorkbook = {
      sheets: [
        { name: '表', cells: [[100, '=TAX(A1)', '=TAX(,0.1)', '=TAX(F1,0.1)', '=TAX("x")']] },
      ],
    }
    const engine = new SheetFormulaEngine(doc, { functions: [TAX] })
    expect(engine.result(0, 'B1')).toBeCloseTo(106)
    expect(engine.result(0, 'C1')).toBe(0)
    expect(engine.result(0, 'D1')).toBe(0)
    expect(show(engine.result(0, 'E1'))).toBe('#VALUE!')
  })

  it('writes results into CSV', () => {
    const doc = book()
    const engine = new SheetFormulaEngine(doc)
    const csv = sheetToCSV(doc.sheets[0]!, { result: (row, col) => engine.result(0, row, col) })
    expect(csv).toBe('10,20,30\r\n60,70,30')
    // stored, the formulas stay
    expect(sheetToCSV(doc.sheets[0]!, { formatted: false })).toContain('=A1+B1')
  })
})

function setup(extensions: SheetExtension[] = []) {
  const doc = ref<SheetWorkbook>({
    sheets: [
      {
        name: '表1',
        cells: [
          [{ value: 1280, format: '#,##0' }, 640, '=A1+B1'],
          ['=1/0', '=A1*', '=DOUBLE(B1)'],
        ],
        rowCount: 6,
        colCount: 4,
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
          extensions,
        }),
    ),
    { attachTo: document.body },
  )
  const texts = () => wrapper.findAll('.dou-sheet__cell').map((cell) => cell.text())
  return { wrapper, doc, grid, texts }
}

describe('DouSheet with formulas', () => {
  it('shows results, errors in the middle', async () => {
    const { wrapper, texts } = setup()
    await nextTick()
    expect(texts().slice(0, 3)).toEqual(['1,280', '640', '1920'])
    const error = wrapper.find('.dou-sheet__cell.is-error')
    expect(error.find('.dou-sheet__text').text()).toBe('#DIV/0!')
    expect(error.classes()).toContain('is-error')
    expect(error.classes()).toContain('is-align-center')
    // why, on hover and for screen readers
    expect(error.attributes('title')).toBe('除以 0')
    // the reason is read out after the error value
    expect(texts()).toContain('#ERROR!（公式写法有误）')
    expect(texts()).toContain('#NAME?（没有这个函数）')
    wrapper.unmount()
  })

  it('shows new results after a change', async () => {
    const { wrapper, grid, texts } = setup()
    await nextTick()
    grid.value!.transact((tr) => tr.setCell('B1', 1000))
    await nextTick()
    expect(texts()[2]).toBe('2280')
    grid.value!.undo()
    await nextTick()
    expect(texts()[2]).toBe('1920')
    expect(grid.value!.toCSV()).toBe('"1,280",640,1920\r\n#DIV/0!,#ERROR!,#NAME?')
    wrapper.unmount()
  })

  it('calls functions extensions add', async () => {
    const extension = defineSheetExtension({
      name: 'double',
      functions: [
        defineSheetFunction({
          name: 'DOUBLE',
          run: ([value]) => (typeof value === 'number' ? value * 2 : SheetError.of('#VALUE!')),
        }),
      ],
    })
    const { wrapper, texts } = setup([extension])
    await nextTick()
    expect(texts()).toContain('1280')
    expect(wrapper.find('.is-error').exists()).toBe(true)
    expect(texts()).not.toContain('#NAME?（没有这个函数）')
    wrapper.unmount()
  })
})
