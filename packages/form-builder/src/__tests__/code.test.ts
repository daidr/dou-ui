import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { CodeText, lineParts, tokenizeLine } from '@dou-ui/code'
import type { CodeExtensionContext } from '@dou-ui/code'
import { DouFormBuilder } from '../index'
import type { FormDocument } from '../index'
import { codeExpressions, expressionCodeExtension, formExpression } from '../code'

/** Just what the extension reads of an editor. */
const at = (text: string) => ({ doc: CodeText.of(text) }) as unknown as CodeExtensionContext
const signal = new AbortController().signal

const extension = expressionCodeExtension({
  names: [
    { path: 'price', label: '单价' },
    { path: 'contact.phone', label: '电话' },
  ],
  functionInfo: {
    round: { signature: 'round(value, digits?)', info: '四舍五入' },
    sum: { signature: 'sum(...numbers)' },
  },
  labels: { values: '表单的值' },
})

const hint = (text: string) =>
  extension.signature!({ pos: text.length, signal }, at(text)) as {
    active: number
    label: string
  } | null

function complete(text: string, explicit = false) {
  const pos = text.length
  const word = /[\p{L}\p{N}_$]*$/u.exec(text)![0]
  return extension.completion!(
    { pos, word: { from: pos - word.length, to: pos, text: word }, explicit, signal },
    at(text),
  ) as { from: number; options: Array<{ label: string; snippet?: string }> } | null
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('expression code extension', () => {
  it('completes field paths after values., dots and all', () => {
    const result = complete('values.con')!
    expect(result.from).toBe(7)
    expect(result.options.map((o) => o.label)).toEqual(['price', 'contact.phone'])
    expect(complete("'values.")).toBeNull()
  })

  it('offers values, functions as snippets of their required parameters, and keywords', () => {
    const result = complete('ro')!
    const labels = result.options.map((o) => o.label)
    expect(labels).toContain('values')
    expect(labels).toContain('true')
    expect(result.options.find((o) => o.label === 'round')!.snippet).toBe('round(${1:value})')
    expect(result.options.find((o) => o.label === 'sum')!.snippet).toBe('sum(${1:numbers})')
    expect(result.options.find((o) => o.label === 'len')!.snippet).toBe('len($0)')
  })

  it('shows parameter hints in a call, the rest parameter taking the remaining arguments', () => {
    expect(hint('round(values.price, ')!.active).toBe(1)
    expect(hint("round('a,(', ")!.active).toBe(1)
    expect(hint('sum(1, 2, 3')!.active).toBe(0)
    expect(hint('round(1, 2, ')).toBeNull()
    expect(hint('round(1) + ')).toBeNull()
  })

  it('explains a function under the pointer and underlines problems', async () => {
    const hover = extension.hover!({ pos: 2, signal }, at('round(1)')) as { content: string }
    expect(hover.content).toBe('round(value, digits?)\n四舍五入')
    const problems = (await extension.lint!(at('values.nope + 1'))) ?? []
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ from: 0, to: 11, severity: 'error' })
  })

  it('colors names, paths, calls and literals', () => {
    const text = "round(values.price, 2) in ['a'] && nope"
    const parts = lineParts(text, tokenizeLine(formExpression, text, formExpression.startState()))
    const typeOf = (piece: string) => parts.find(([t]) => t === piece)?.[1]
    expect(typeOf('round')).toBe('function')
    expect(typeOf('values')).toBe('variable')
    expect(typeOf('price')).toBe('property')
    expect(typeOf('2')).toBe('number')
    expect(typeOf('in')).toBe('keyword')
    expect(typeOf("'a'")).toBe('string')
    expect(typeOf('nope')).toBe('invalid')
  })
})

describe('codeExpressions', () => {
  it('puts a code input in place of the expression boxes', async () => {
    const form = ref<FormDocument>({
      version: 1,
      nodes: [
        { id: 'price', type: 'number', name: 'price', label: '单价' },
        { id: 'total', type: 'number', name: 'total', label: '合计', formula: 'values.price * 2' },
      ],
    })
    const wrapper = mount(
      {
        render: () =>
          h(DouFormBuilder, {
            modelValue: form.value,
            'onUpdate:modelValue': (next: FormDocument) => (form.value = next),
            selection: ['total'],
            extensions: [codeExpressions()],
          }),
      },
      { attachTo: document.body },
    )
    await nextTick()
    await nextTick()
    const inputs = wrapper.findAll('.dou-code-input')
    expect(inputs.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('values.price * 2')
  })
})
