import { describe, expect, it } from 'vitest'
import type { SheetWorkbook } from '../index'
import { SheetError, SheetFormulaEngine, type SheetResult } from '../formula'

/** Works out one formula over some cells of a sheet named 表1. */
function calc(formula: string, cells: SheetWorkbook['sheets'][number]['cells'] = []) {
  const engine = new SheetFormulaEngine(
    { sheets: [{ name: '表1', cells }] },
    { now: () => new Date(2026, 9, 31, 9, 30) },
  )
  return show(engine.evaluate(formula))
}

const show = (value: SheetResult) => (value instanceof SheetError ? value.code : value)

describe('the second batch of functions', () => {
  const scores = [
    ['姓名', '城市', '分数', '奖金'],
    ['戴兜', '上海', 88, 1200],
    ['阿青', '杭州', 95, 1500],
    ['小林', '上海', 72, 800],
    ['阿木', '苏州', 95, null],
    ['小周', '上海', '缺考', 600],
  ]

  it('works out statistics', () => {
    expect(calc('=SUMPRODUCT(C2:C4, D2:D4)', scores)).toBe(88 * 1200 + 95 * 1500 + 72 * 800)
    // text counts as 0, and the ranges must be the same size
    expect(calc('=SUMPRODUCT(C2:C6, D2:D6)', scores)).toBe(88 * 1200 + 95 * 1500 + 72 * 800)
    expect(calc('=SUMPRODUCT(C2:C3, D2:D4)', scores)).toBe('#VALUE!')
    expect(calc('=MEDIAN(C2:C6)', scores)).toBe(91.5)
    expect(calc('=MEDIAN(3, 1, 2)')).toBe(2)
    expect(calc('=LARGE(C2:C6, 1)', scores)).toBe(95)
    expect(calc('=LARGE(C2:C6, 3)', scores)).toBe(88)
    expect(calc('=SMALL(C2:C6, 1)', scores)).toBe(72)
    expect(calc('=SMALL(C2:C6, 5)', scores)).toBe('#NUM!')
    expect(calc('=RANK(88, C2:C6)', scores)).toBe(3)
    expect(calc('=RANK.EQ(95, C2:C6)', scores)).toBe(1)
    expect(calc('=RANK(72, C2:C6, 1)', scores)).toBe(1)
    expect(calc('=RANK(70, C2:C6)', scores)).toBe('#N/A')
    expect(calc('=STDEV(2, 4, 4, 4, 5, 5, 7, 9)')).toBeCloseTo(2.13809, 4)
    expect(calc('=STDEV.P(2, 4, 4, 4, 5, 5, 7, 9)')).toBe(2)
    expect(calc('=VAR.P(2, 4, 4, 4, 5, 5, 7, 9)')).toBe(4)
    expect(calc('=VAR.S(1, 3)')).toBe(2)
    expect(calc('=STDEV(5)')).toBe('#DIV/0!')
    expect(calc('=PERCENTILE(C2:C6, 0.5)', scores)).toBe(91.5)
    expect(calc('=PERCENTILE.INC(C2:C4, 0.25)', scores)).toBe(80)
    expect(calc('=PERCENTILE(C2:C6, 1.5)', scores)).toBe('#NUM!')
    expect(calc('=MAXIFS(C2:C6, B2:B6, "上海")', scores)).toBe(88)
    expect(calc('=MINIFS(D2:D6, B2:B6, "上海", C2:C6, ">70")', scores)).toBe(800)
    expect(calc('=MAXIFS(C2:C6, B2:B6, "北京")', scores)).toBe(0)
  })

  it('rounds to steps, and works out logs and random numbers', () => {
    expect(calc('=CEILING(2.3, 0.1)')).toBe(2.3)
    expect(calc('=CEILING(23, 5)')).toBe(25)
    expect(calc('=CEILING(-2.5, 2)')).toBe(-2)
    expect(calc('=CEILING(2.5, -2)')).toBe('#NUM!')
    expect(calc('=FLOOR(27, 5)')).toBe(25)
    expect(calc('=FLOOR(-2.5, -2)')).toBe(-2)
    expect(calc('=FLOOR(3, 0)')).toBe('#DIV/0!')
    expect(calc('=TRUNC(-8.97)')).toBe(-8)
    expect(calc('=TRUNC(3.14159, 2)')).toBe(3.14)
    expect(calc('=SIGN(-3)')).toBe(-1)
    expect(calc('=ROUND(PI() * 100, 0)')).toBe(314)
    expect(calc('=LN(EXP(2))')).toBeCloseTo(2, 12)
    expect(calc('=LOG(8, 2)')).toBe(3)
    expect(calc('=LOG(1000)')).toBe(3)
    expect(calc('=LOG10(0)')).toBe('#NUM!')
    expect(calc('=LOG(8, 1)')).toBe('#DIV/0!')
    const r = calc('=RAND()') as number
    expect(r >= 0 && r < 1).toBe(true)
    const n = calc('=RANDBETWEEN(1.2, 3)') as number
    expect([2, 3]).toContain(n)
    expect(calc('=RANDBETWEEN(5, 1)')).toBe('#NUM!')
  })

  it('chooses and tests values', () => {
    expect(calc('=XOR(TRUE, FALSE)')).toBe(true)
    expect(calc('=XOR(TRUE, TRUE, TRUE)')).toBe(true)
    expect(calc('=XOR(TRUE, TRUE)')).toBe(false)
    expect(calc('=SWITCH(B2, "上海", "华东", "北京", "华北", "其他")', scores)).toBe('华东')
    expect(calc('=SWITCH(B4, "北京", "华北", "其他")', [[], [], [], ['', '', '']])).toBe('其他')
    expect(calc('=SWITCH(2, 1, "一")')).toBe('#N/A')
    // only the branch it takes is worked out
    expect(calc('=SWITCH(1, 1, "一", 2, 1/0)')).toBe('一')
    expect(calc('=CHOOSE(2, "春", "夏", "秋")')).toBe('夏')
    expect(calc('=CHOOSE(4, "春", "夏", "秋")')).toBe('#VALUE!')
    expect(calc('=CHOOSE(1, "春", 1/0)')).toBe('春')
    expect(calc('=ISLOGICAL(1=1)')).toBe(true)
    expect(calc('=ISLOGICAL(1)')).toBe(false)
    expect(calc('=ISERR(1/0)')).toBe(true)
    expect(calc('=ISERR(NA())')).toBe(false)
    expect(calc('=ISNA(NA())')).toBe(true)
    expect(calc('=ISERR(XMATCH(9, C2:C3))', scores)).toBe(false)
    expect(calc('=ISEVEN(-2.5)')).toBe(true)
    expect(calc('=ISODD(3)')).toBe(true)
    expect(calc('=ISODD("x")')).toBe('#VALUE!')
  })

  it('works with text', () => {
    expect(calc('=PROPER("hello WORLD, 2-way")')).toBe('Hello World, 2-Way')
    expect(calc('=REPLACE("上海展览中心", 3, 2, "会展")')).toBe('上海会展中心')
    expect(calc('=REPLACE("abc", 0, 1, "x")')).toBe('#VALUE!')
    expect(calc('=TEXTBEFORE("戴兜@上海.example", "@")')).toBe('戴兜')
    expect(calc('=TEXTAFTER("戴兜@上海.example", "@")')).toBe('上海.example')
    expect(calc('=TEXTAFTER("a-b-c", "-", -1)')).toBe('c')
    expect(calc('=TEXTBEFORE("a-b-c", "-", 2)')).toBe('a-b')
    expect(calc('=TEXTBEFORE("a-b-c", "-", -1)')).toBe('a-b')
    expect(calc('=TEXTAFTER("aXbxc", "x", 1, 1)')).toBe('bxc')
    expect(calc('=TEXTAFTER("aXbxc", "x")')).toBe('c')
    expect(calc('=TEXTBEFORE("abc", "-")')).toBe('#N/A')
    expect(calc('=TEXTBEFORE("abc", "-", 1, 0, 0, "无")')).toBe('无')
    // with match end, the end of the text counts as a delimiter
    expect(calc('=TEXTBEFORE("abc", "-", 1, 0, 1)')).toBe('abc')
    expect(calc('=TEXTAFTER("abc", "-", -1, 0, 1)')).toBe('abc')
    expect(calc('=TEXTBEFORE("a-b", "-", 0)')).toBe('#VALUE!')
    expect(calc('=CHAR(65)')).toBe('A')
    expect(calc('=CODE("A")')).toBe(65)
    expect(calc('=UNICHAR(25140)')).toBe('戴')
    expect(calc('=UNICODE("戴兜")')).toBe(25140)
    expect(calc('=CODE("")')).toBe('#VALUE!')
    expect(calc('=CLEAN("a" & CHAR(10) & "b")')).toBe('ab')
  })

  it('works with dates and times', () => {
    expect(calc('=TIME(9, 30, 0)')).toBe('09:30')
    expect(calc('=TIME(25, 0, 5)')).toBe('01:00:05')
    expect(calc('=HOUR("2026-03-05 14:45")')).toBe(14)
    expect(calc('=MINUTE("09:30")')).toBe(30)
    expect(calc('=SECOND(TIME(1, 2, 3))')).toBe(3)
    expect(calc('=HOUR(0.75)')).toBe(18)
    expect(calc('=EDATE("2026-01-31", 1)')).toBe('2026-02-28')
    expect(calc('=EDATE("2026-03-15", -3)')).toBe('2025-12-15')
    expect(calc('=EOMONTH("2026-02-10", 0)')).toBe('2026-02-28')
    expect(calc('=EOMONTH("2026-02-10", 1)')).toBe('2026-03-31')
    expect(calc('=DAYS("2026-03-05", "2026-02-01")')).toBe(32)
    // 2026-02-02 is a Monday; one holiday on Wednesday
    const holidays = [['2026-02-04']]
    expect(calc('=NETWORKDAYS("2026-02-02", "2026-02-15")')).toBe(10)
    expect(calc('=NETWORKDAYS("2026-02-02", "2026-02-15", A1)', holidays)).toBe(9)
    expect(calc('=NETWORKDAYS("2026-02-15", "2026-02-02")')).toBe(-10)
    expect(calc('=WORKDAY("2026-02-06", 1)')).toBe('2026-02-09')
    expect(calc('=WORKDAY("2026-02-02", 2, A1)', holidays)).toBe('2026-02-05')
    expect(calc('=WORKDAY("2026-02-09", -1)')).toBe('2026-02-06')
    expect(calc('=WEEKNUM("2026-01-01")')).toBe(1)
    // January 4, 2026 is a Sunday
    expect(calc('=WEEKNUM("2026-01-04")')).toBe(2)
    expect(calc('=WEEKNUM("2026-01-04", 2)')).toBe(1)
    expect(calc('=ISOWEEKNUM("2026-01-01")')).toBe(1)
    expect(calc('=ISOWEEKNUM("2027-01-01")')).toBe(53)
    expect(calc('=WEEKNUM("2027-01-01", 21)')).toBe(53)
    expect(calc('=DATEVALUE("2026/3/5")')).toBe('2026-03-05')
    expect(calc('=DATEVALUE("明天")')).toBe('#VALUE!')
    expect(calc('=TIMEVALUE("2026-03-05 14:45")')).toBe('14:45')
  })

  it('finds positions and sizes', () => {
    expect(calc('=XMATCH("阿青", A2:A6)', scores)).toBe(2)
    expect(calc('=XMATCH(95, C2:C6, 0, -1)', scores)).toBe(4)
    expect(calc('=XMATCH(90, C2:C4, 1)', scores)).toBe(2)
    expect(calc('=XMATCH(90, C2:C4, -1)', scores)).toBe(1)
    expect(calc('=XMATCH("阿*", A2:A6, 2)', scores)).toBe(2)
    expect(calc('=XMATCH("北京", B2:B6)', scores)).toBe('#N/A')
    expect(calc('=ROWS(A2:D6)')).toBe(5)
    expect(calc('=COLUMNS(A2:D6)')).toBe(4)
    expect(calc('=ROWS(A1)')).toBe(1)
  })

  it('works out loans and savings', () => {
    // 300,000 over 30 years at 4.9% a year, paid monthly
    expect(calc('=ROUND(PMT(4.9%/12, 360, 300000), 2)')).toBe(-1592.18)
    expect(calc('=PMT(0, 10, 1000)')).toBe(-100)
    expect(calc('=ROUND(FV(3%/12, 120, -1000), 2)')).toBe(139741.42)
    expect(calc('=ROUND(PV(4.9%/12, 360, -1592.18), 0)')).toBe(300000)
    expect(calc('=ROUND(NPV(10%, -10000, 3000, 4200, 6800), 2)')).toBe(1188.44)
  })
})
