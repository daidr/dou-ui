import { describe, expect, it, vi } from 'vitest'
import { reactive, computed } from 'vue'
import {
  checkExpression,
  compileExpression,
  equalValues,
  evaluateExpression,
  ExpressionError,
  findFormulaCycles,
  parseExpression,
  truthy,
} from '../index'
import type { FormDocument } from '../index'

const run = (source: string, values: Record<string, unknown> = {}, value?: unknown) =>
  evaluateExpression(source, { values, value })

describe('expression values', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['10 / 4', 2.5],
    ['7 % 3', 1],
    ['-2 + 5', 3],
    ['1.5e2', 150],
    ['.5 + .25', 0.75],
    ["'a' + 1", 'a1'],
    ["'共 ' + null + ' 件'", '共  件'],
    ['1 / 0', null],
    [`"it\\'s" + '\\n'`, "it's\n"],
    ["'\\u4E0A海'", '上海'],
    ['true && false', false],
    ['null || 3', 3],
    ["'' || 'x'", 'x'],
    ['[] || 1', 1],
    ['!0', true],
    ['!![1]', true],
    ['1 < 2 ? "yes" : "no"', 'yes'],
    ['1 > 2 ? 1 : 2 > 1 ? 3 : 4', 3],
    ['[1, 2, ] == [1, 2]', true],
  ])('%s → %j', (source, expected) => {
    expect(run(source)).toEqual(expected)
  })

  it.each([
    ['values.a.b', { a: { b: 1 } }, 1],
    ['values.missing.deep', {}, null],
    ["values['a-b']", { 'a-b': 2 }, 2],
    ['values.list[1]', { list: [1, 2] }, 2],
    ['values.list.length', { list: [1, 2] }, 2],
    ['values.name.length', { name: '戴兜' }, 2],
    ['values.name[0]', { name: '戴兜' }, '戴'],
    ['values.missing == null', {}, true],
    ['values.a == values.b', { a: [1, { x: 2 }], b: [1, { x: 2 }] }, true],
    ["values.city in ['sh', 'bj']", { city: 'sh' }, true],
    ["'海' in values.city", { city: '上海' }, true],
    ["'x' in values.o", { o: { x: 1 } }, true],
    ['values.age >= 18', { age: '20' }, true],
    ['values.age >= 18', { age: '' }, false],
    ['values.age < 18', { age: null }, false],
    ['values.end >= values.start', { start: '2026-10-01', end: '2026-10-31' }, true],
    ['values.price * values.count', { price: 12.5, count: 4 }, 50],
    ['values.price * values.count', { price: 12.5, count: null }, 0],
    ['values.tags && len(values.tags)', { tags: [] }, []],
  ])('%s with %j → %j', (source, values, expected) => {
    expect(run(source, values)).toEqual(expected)
  })

  it('reads the field’s own value', () => {
    expect(run('value >= values.min', { min: 3 }, 5)).toBe(true)
    expect(run('value', {})).toBe(null)
  })

  it('treats false, null, 0, NaN, blank text and empty lists as false', () => {
    for (const value of [false, null, undefined, 0, Number.NaN, '', []])
      expect(truthy(value)).toBe(false)
    for (const value of [true, 1, 'a', [0], {}]) expect(truthy(value)).toBe(true)
  })

  it('compares by value', () => {
    expect(equalValues(null, undefined)).toBe(true)
    expect(equalValues({ a: [1] }, { a: [1] })).toBe(true)
    expect(equalValues({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(equalValues([1], { 0: 1 })).toBe(false)
  })
})

describe('expression functions', () => {
  it.each([
    ["len('戴兜')", 2],
    ['len([1, 2, 3])', 3],
    ['len(null)', 0],
    ["empty('  ')", true],
    ['empty([])', true],
    ['empty(0)', false],
    ["number('12.5')", 12.5],
    ["number('x')", null],
    ["number('')", null],
    ['sum([1, 2, null, "3"])', 6],
    ['sum(1, 2, 3)', 6],
    ['min([4, 2, 8])', 2],
    ['max(4, 2, 8)', 8],
    ['max([])', null],
    ['round(1.005, 2)', 1.01],
    ['round(-2.5)', -3],
    ['round(1234.5678, 1)', 1234.6],
    ['abs(-3)', 3],
    ["days('2026-10-01', '2026-10-31')", 30],
    ["days('2026-03-28', '2026-03-30')", 2],
    ["days('x', '2026-10-31')", null],
    ["contains(['a', 'b'], 'b')", true],
    ["contains('上海', '上')", true],
  ])('%s → %j', (source, expected) => {
    expect(run(source)).toEqual(expected)
  })

  it('gives today and days around it as YYYY-MM-DD', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 31, 23, 30))
    expect(run('today()')).toBe('2026-10-31')
    expect(run('today(1)')).toBe('2026-11-01')
    expect(run('today(-31)')).toBe('2026-09-30')
    vi.useRealTimers()
  })

  it('calls functions the app registers, which can replace built-in ones', () => {
    const functions = { tax: (price: number) => price * 0.06, len: () => 99 }
    expect(
      evaluateExpression('round(tax(values.price), 2)', { values: { price: 100 }, functions }),
    ).toBe(6)
    expect(evaluateExpression('len("ab")', { values: {}, functions })).toBe(99)
  })

  it('gives null and warns once when a function throws or is unknown', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scope = {
      values: {},
      functions: {
        boom: () => {
          throw new Error('爆')
        },
      },
    }
    expect(evaluateExpression('boom()', scope)).toBe(null)
    expect(evaluateExpression('boom()', scope)).toBe(null)
    expect(evaluateExpression('nope(1)', { values: {} })).toBe(null)
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})

describe('expression safety', () => {
  it.each([
    'values.constructor',
    "values['__proto__']",
    'values.toString',
    'values.list.constructor',
    'values.name.constructor',
    "'x'.constructor",
  ])('%s reads nothing', (source) => {
    expect(run(source.replace("'x'", 'values.name'), { list: [], name: 'x' })).toBe(null)
  })

  it('cannot reach globals: every bare name but values and value is an error', () => {
    for (const source of ['window', 'globalThis.x', 'this', 'Function("1")()', 'process'])
      expect(() => parseExpression(source)).toThrow(ExpressionError)
  })

  it('cannot assign, and says how to compare', () => {
    const error = (() => {
      try {
        parseExpression("values.a = 'x'")
      } catch (caught) {
        return caught as ExpressionError
      }
    })()
    expect(error?.code).toBe('assignment')
    expect(error?.start).toBe(9)
  })

  it.each([
    ['1 +', 'unexpected-end', 3],
    ['(1', 'unexpected-end', 2],
    ["'abc", 'unterminated-string', 0],
    ['1 2', 'unexpected-token', 2],
    ['a & b', 'unexpected-character', 2],
    ['values.a #', 'unexpected-character', 9],
    ['foo', 'unknown-name', 0],
    ['values.', 'unexpected-end', 7],
  ])('%s fails with %s at %i', (source, code, start) => {
    expect(() => parseExpression(source)).toThrow(expect.objectContaining({ code, start }))
  })

  it('stops expressions that nest too deeply or run too long', () => {
    expect(() => parseExpression(`${'('.repeat(200)}1${')'.repeat(200)}`)).toThrow(/too deeply/)
    expect(() => parseExpression('!'.repeat(200) + '1')).toThrow(/too deeply/)
    expect(() => parseExpression('1+'.repeat(3000) + '1')).toThrow(/at most/)
  })
})

describe('expression analysis', () => {
  it.each([
    ['values.a + values.b.c', ['a', 'b.c']],
    ['values.contact.phone && values.contact', ['contact']],
    ['values.rows[values.i].name', ['i', 'rows']],
    ['values[values.key]', ['']],
    ['len(values)', ['']],
    ['value > 1', []],
  ])('%s reads %j', (source, fields) => {
    expect(compileExpression(source).fields).toEqual(fields)
  })

  it('knows the functions it calls and whether it reads value', () => {
    const compiled = compileExpression('round(sum(values.list), 2) > value')
    expect(compiled.calls).toEqual(['round', 'sum'])
    expect(compiled.readsValue).toBe(true)
  })

  it('compiles each source once', () => {
    expect(compileExpression('values.x + 1')).toBe(compileExpression('values.x + 1'))
  })

  it('tracks only what it reads, so Vue reruns it only for those values', () => {
    const values = reactive<Record<string, unknown>>({ type: 'a', other: 1 })
    const expression = compileExpression("values.type == 'laptop'")
    let runs = 0
    const result = computed(() => (runs++, expression.evaluate({ values })))
    expect(result.value).toBe(false)
    values.other = 2
    expect(result.value).toBe(false)
    expect(runs).toBe(1)
    values.type = 'laptop'
    expect(result.value).toBe(true)
    expect(runs).toBe(2)
  })

  it('tracks a key that is missing until later', () => {
    const values = reactive<Record<string, unknown>>({})
    const result = computed(() => evaluateExpression('values.late', { values }))
    expect(result.value).toBe(null)
    values.late = 1
    expect(result.value).toBe(1)
  })

  it('points at problems for an editor', () => {
    expect(
      checkExpression('values.a + values.contact.phone + values.b', { fields: ['a', 'contact'] }),
    ).toEqual([{ code: 'unknown-field', message: 'There is no field "b"', start: 34, end: 42 }])
    expect(checkExpression('tax(values.a) + len(1)', { fields: ['a'] })).toEqual([
      { code: 'unknown-function', message: 'There is no function "tax"', start: 0, end: 3 },
    ])
    expect(checkExpression('tax(1)', { functions: ['tax'] })).toEqual([])
    expect(checkExpression('1 +')[0]?.code).toBe('unexpected-end')
  })
})

const doc = (nodes: FormDocument['nodes']): FormDocument => ({ version: 1, nodes })

describe('formula cycles', () => {
  it('finds formulas that read each other, and ones that read themselves', () => {
    expect(
      findFormulaCycles(
        doc([
          { id: '1', type: 'input-number', name: 'a', formula: 'values.b + 1' },
          { id: '2', type: 'input-number', name: 'b', formula: 'values.c + 1' },
          { id: '3', type: 'input-number', name: 'c', formula: 'values.a + 1' },
          { id: '4', type: 'input-number', name: 'd', formula: 'values.d + 1' },
          { id: '5', type: 'input-number', name: 'e', formula: 'value + 1' },
          { id: '6', type: 'input-number', name: 'f', formula: 'values.a + values.g' },
          { id: '7', type: 'input-number', name: 'g' },
        ]),
      ),
    ).toEqual([['a', 'b', 'c'], ['d'], ['e']])
  })

  it('finds none in a chain', () => {
    expect(
      findFormulaCycles(
        doc([
          { id: '1', type: 'input-number', name: 'total', formula: 'values.sub + values.tax' },
          { id: '2', type: 'input-number', name: 'tax', formula: 'values.sub * 0.06' },
          { id: '3', type: 'input-number', name: 'sub', formula: 'values.price * values.count' },
        ]),
      ),
    ).toEqual([])
  })
})
