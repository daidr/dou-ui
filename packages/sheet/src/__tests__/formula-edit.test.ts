import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { argNameAt, callAt, canPointAt, formulaReferences, formulaTokens, nameAt } from '../formula'
import {
  defineSheetExtension,
  defineSheetFunction,
  DouSheet,
  DouSheetFormulaBar,
  type SheetWorkbook,
} from '../index'

describe('formula editing helpers', () => {
  it('reads tokens with their places, also when unfinished', () => {
    const tokens = formulaTokens('=SUM(A1:B2, "x')
    expect(tokens.map((t) => [t.kind, t.start, t.end])).toEqual([
      ['name', 1, 4],
      ['op', 4, 5],
      ['ref', 5, 10],
      ['op', 10, 11],
      ['text', 12, 14],
    ])
  })

  it('colors references, the same one alike', () => {
    const marks = formulaReferences("=A1+B2:C3*a1+'表 2'!A1")
    expect(marks.map((m) => [m.text, m.color])).toEqual([
      ['A1', 0],
      ['B2:C3', 1],
      ['a1', 0],
      ["'表 2'!A1", 2],
    ])
    expect(marks[3]!.sheet).toBe('表 2')
    expect(formulaReferences('A1+B2')).toEqual([])
  })

  it('knows where a reference can go', () => {
    expect(canPointAt('=', 1)).toBe(true)
    expect(canPointAt('=SUM(', 5)).toBe(true)
    expect(canPointAt('=A1+', 4)).toBe(true)
    expect(canPointAt('=A1', 3)).toBe(false)
    expect(canPointAt('=SUM(A1', 5)).toBe(false)
    expect(canPointAt('=(+1)', 2)).toBe(true)
    expect(canPointAt('=(1)', 2)).toBe(false)
    expect(canPointAt('12', 1)).toBe(false)
  })

  it('finds the call and the argument the caret is in', () => {
    expect(callAt('=IF(A1>0, SUM(', 14)).toEqual({ name: 'SUM', arg: 0, count: 1 })
    expect(callAt('=IF(A1>0, SUM(B1)', 17)).toEqual({ name: 'IF', arg: 1, count: 2 })
    expect(callAt('=(1, 2', 6)).toBeNull()
  })

  it('finds the name being typed', () => {
    expect(nameAt('=su', 3)).toEqual({ start: 1, end: 3, text: 'su' })
    expect(nameAt('=1+COUN', 7)?.text).toBe('COUN')
    expect(nameAt('=SUM(', 4)).toBeNull()
    expect(nameAt('="su', 4)).toBeNull()
  })
})

const book = (): SheetWorkbook => ({
  version: 1,
  sheets: [{ name: '表 1', cells: [[1, 2, 3], [4, 5, 6], [null]] }],
})

function setup(bar = false, extra: Record<string, unknown> = {}) {
  const doc = ref(book())
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouSheet,
          {
            modelValue: doc.value,
            'onUpdate:modelValue': (value: SheetWorkbook) => (doc.value = value),
            ...extra,
          },
          bar ? { header: () => h(DouSheetFormulaBar) } : undefined,
        ),
    ),
    { attachTo: document.body },
  )
  const input = wrapper.find('textarea.dou-sheet__input').element as HTMLTextAreaElement
  const key = async (name: string, init: KeyboardEventInit = {}) => {
    const target = document.activeElement ?? input
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
    )
    await nextTick()
  }
  const type = async (text: string) => {
    input.value += text
    input.setSelectionRange(input.value.length, input.value.length)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }
  return { wrapper, doc, input, key, type }
}

describe('DouSheet formula editing', () => {
  it('points at cells with the arrows, and Shift makes a range', async () => {
    const { input, key, type, doc, wrapper } = setup()
    input.focus()
    await key('ArrowDown')
    await key('ArrowDown')
    await type('=')
    await key('ArrowUp')
    expect(input.value).toBe('=A2')
    await key('ArrowUp')
    expect(input.value).toBe('=A1')
    await key('ArrowRight', { shiftKey: true })
    expect(input.value).toBe('=A1:B1')
    await type('+')
    await key('ArrowUp')
    expect(input.value).toBe('=A1:B1+A2')
    expect(wrapper.find('.dou-sheet__input.is-mirror').text()).toContain('A1:B1')
    await key('Enter')
    expect(doc.value.sheets[0]!.cells[2]![0]).toBe('=A1:B1+A2')
  })

  it('moves on with the arrows where no reference can go', async () => {
    const { input, key, type, doc } = setup()
    input.focus()
    await key('ArrowDown')
    await key('ArrowDown')
    await type('=A1')
    await key('ArrowRight')
    expect(doc.value.sheets[0]!.cells[2]![0]).toBe('=A1')
  })

  it('lists functions by the name typed and writes the one picked', async () => {
    const { input, key, type, wrapper } = setup()
    input.focus()
    await key('ArrowDown')
    await key('ArrowDown')
    await type('=coun')
    const names = () =>
      wrapper.findAll('.dou-sheet__assist-item .dou-sheet__assist-name').map((n) => n.text())
    expect(names()).toEqual(['COUNT', 'COUNTIF', 'COUNTA', 'COUNTBLANK', 'COUNTIFS'])
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-assist-0$/)
    await key('ArrowDown')
    await key('ArrowDown')
    await key('Tab')
    expect(input.value).toBe('=COUNTA(')
    // in the call, what it takes
    const hint = wrapper.find('.dou-sheet__assist')
    expect(hint.attributes('role')).toBe('tooltip')
    expect(hint.find('.is-current').text()).toBe('值1')
    await type('A1,')
    expect(wrapper.find('.dou-sheet__assist .is-current').text()).toBe('[值2]')
  })

  it('closes the list with Escape until the text changes', async () => {
    const { input, key, type, wrapper } = setup()
    input.focus()
    await type('=su')
    expect(wrapper.find('[role=listbox]').exists()).toBe(true)
    await key('Escape')
    expect(wrapper.find('[role=listbox]').exists()).toBe(false)
    expect(wrapper.find('.dou-sheet__input.is-open').exists()).toBe(true)
    await type('m')
    expect(wrapper.find('[role=listbox]').exists()).toBe(true)
    // the ones used most first
    expect(wrapper.findAll('.dou-sheet__assist-name').map((n) => n.text())).toEqual([
      'SUM',
      'SUMIF',
      'SUMIFS',
      'SUMPRODUCT',
    ])
  })

  it('describes functions of its own', async () => {
    const own = defineSheetExtension({
      name: 'own',
      functions: [
        defineSheetFunction({
          name: 'DOUBLE',
          args: ['数'],
          description: '乘以 2',
          run: (args) => Number(args[0]) * 2,
        }),
      ],
    })
    const { input, type, wrapper } = setup(false, { extensions: [own] })
    input.focus()
    await type('=dou')
    expect(wrapper.find('.dou-sheet__assist-item').text()).toContain('乘以 2')
  })
})

describe('DouSheetFormulaBar', () => {
  it('shows the active cell and its formula, and edits along with the cell', async () => {
    const { wrapper, input, key, type, doc } = setup(true)
    const name = wrapper.find('.dou-sheet-formula-bar__name').element as HTMLInputElement
    const box = wrapper.find('.dou-sheet-formula-bar__input').element as HTMLTextAreaElement
    expect(name.value).toBe('A1')
    expect(box.value).toBe('1')
    input.focus()
    await key('ArrowDown')
    await key('ArrowDown')
    await type('=A1+')
    expect(name.value).toBe('A3')
    expect(box.value).toBe('=A1+')
    // typed in the bar: the cell shows it too, and Enter saves it
    box.focus()
    box.value = '=A1+B1'
    box.setSelectionRange(6, 6)
    box.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(input.value).toBe('=A1+B1')
    expect(wrapper.find('.dou-sheet__input.is-open').exists()).toBe(true)
    await key('Enter')
    expect(doc.value.sheets[0]!.cells[2]![0]).toBe('=A1+B1')
    expect(document.activeElement).toBe(input)
  })

  it('goes to the cell or range typed in the name box', async () => {
    const { wrapper } = setup(true)
    const name = wrapper.find('.dou-sheet-formula-bar__name')
    await name.setValue('B2')
    await name.trigger('keydown', { key: 'Enter' })
    await nextTick()
    await nextTick()
    expect((name.element as HTMLInputElement).value).toBe('B2')
    expect(
      (wrapper.find('.dou-sheet-formula-bar__input').element as HTMLTextAreaElement).value,
    ).toBe('5')
    await name.setValue('nope')
    await name.trigger('keydown', { key: 'Enter' })
    expect(wrapper.find('[aria-live]').text()).toContain('“nope”不是单元格地址')
    expect((name.element as HTMLInputElement).value).toBe('nope')
    expect(name.attributes('aria-invalid')).toBe('true')
    await name.trigger('keydown', { key: 'Escape' })
    expect((name.element as HTMLInputElement).value).toBe('B2')
    expect(name.attributes('aria-invalid')).toBeUndefined()
  })
})

const names = (args: string, formula: string) => {
  const call = callAt(formula, formula.length)!
  const list = args.split(', ')
  const at = argNameAt(list, call.arg, call.count)
  return at === -1 ? null : list[at]
}

describe('argument hints of repeating arguments', () => {
  const SWITCH = '表达式, 值1, 结果1, [值2, 结果2], …, [默认值]'
  const IFS = '条件1, 值1, [条件2, 值2], …'

  it('repeats pairs, and the default only last', () => {
    expect(names(SWITCH, '=SWITCH(A1,1,"a",2,"b"')).toBe('结果2]')
    expect(names(SWITCH, '=SWITCH(A1,1,"a",2,"b",')).toBe('[默认值]')
    expect(names(SWITCH, '=SWITCH(A1,1,"a",2,"b",3,')).toBe('结果2]')
    expect(names(SWITCH, '=SWITCH(A1,1,"a",2,"b",3,"c",')).toBe('[默认值]')
    expect(names(IFS, '=IFS(A1,1,A2,2,')).toBe('[条件2')
    expect(names(IFS, '=IFS(A1,1,A2,2,A3,')).toBe('值2]')
    expect(names('求和区域, 区域1, 条件1, …', '=SUMIFS(A:A,B:B,1,')).toBe('区域1')
    expect(names('值1, [值2], …', '=SUM(1,2,3,')).toBe('[值2]')
    expect(names('数值, [位数]', '=ROUND(1,2,')).toBeNull()
  })

  it('counts the arguments after the caret too', () => {
    const formula = '=SWITCH(A1,1,"a",2,"b",3)'
    expect(callAt(formula, formula.indexOf(',3') + 1)).toEqual({ name: 'SWITCH', arg: 5, count: 6 })
  })
})
