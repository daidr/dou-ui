import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { matchAfter, replacementFor, searchText } from '../core/search'
import { CodeText } from '../core/text'
import { DouCodeEditor, type CodeEditorExpose, type CodeSelection } from '../index'

const ranges = (text: string, query: Parameters<typeof searchText>[1]) => {
  const doc = CodeText.of(text)
  return searchText(doc, query).matches.map((m) => doc.slice(m.from, m.to) + '@' + m.from)
}

describe('searchText', () => {
  it('finds plain text, ignoring case unless asked', () => {
    expect(ranges('Foo foo FOO', { search: 'foo' })).toEqual(['Foo@0', 'foo@4', 'FOO@8'])
    expect(ranges('Foo foo FOO', { search: 'foo', caseSensitive: true })).toEqual(['foo@4'])
    // Special characters are taken as they are.
    expect(ranges('a.b axb', { search: 'a.b' })).toEqual(['a.b@0'])
  })

  it('keeps whole words only', () => {
    expect(ranges('cat category cat_ $cat cat', { search: 'cat', wholeWord: true })).toEqual([
      'cat@0',
      'cat@23',
    ])
  })

  it('reads regular expressions, across lines too', () => {
    expect(ranges('a1 b22\nc333', { search: '\\d+', regexp: true })).toEqual([
      '1@1',
      '22@4',
      '333@8',
    ])
    expect(ranges('one\ntwo', { search: 'e\\nt', regexp: true })).toEqual(['e\nt@2'])
    expect(ranges('ab\ncd', { search: '^', regexp: true })).toEqual([])
    expect(searchText(CodeText.of('x'), { search: '(', regexp: true }).error).toBeTruthy()
  })

  it('stops at the limit and says so', () => {
    const result = searchText(CodeText.of('aaaa'), { search: 'a' }, 2)
    expect(result.matches.length).toBe(2)
    expect(result.capped).toBe(true)
  })

  it('fills groups into the replacement', () => {
    const doc = CodeText.of('let width = 1')
    const query = {
      search: '(?<kind>let) (\\w+)',
      regexp: true,
      replace: 'const $2 /* $<kind>, $$1, $& */',
    }
    const [m] = searchText(doc, query).matches
    expect(replacementFor(doc, m!, query)).toBe('const width /* let, $1, let width */')
    expect(replacementFor(doc, m!, { search: 'let', replace: '$1' })).toBe('$1')
  })

  it('finds the first match at or after a position, wrapping', () => {
    const matches = [
      { from: 2, to: 3 },
      { from: 5, to: 6 },
    ]
    expect(matchAfter(matches, 0)).toBe(0)
    expect(matchAfter(matches, 3)).toBe(1)
    expect(matchAfter(matches, 6)).toBe(0)
    expect(matchAfter([], 0)).toBe(-1)
  })
})

async function keyOn(el: Element, key: string, init: KeyboardEventInit = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  await nextTick()
}

async function fill(el: HTMLInputElement, value: string) {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

function setup(initial: string, extra: Record<string, unknown> = {}) {
  const code = ref(initial)
  const editor = ref<CodeEditorExpose>()
  const selection = ref<CodeSelection>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouCodeEditor, {
          ref: editor,
          modelValue: code.value,
          'onUpdate:modelValue': (value: string) => (code.value = value),
          'onUpdate:selection': (value: CodeSelection) => (selection.value = value),
          ...extra,
        }),
    ),
    { attachTo: document.body },
  )
  const textarea = wrapper.find('textarea').element as HTMLTextAreaElement
  textarea.focus()
  const selected = () => {
    const main = editor.value!.selection.ranges[editor.value!.selection.main]!
    return (
      code.value.slice(Math.min(main.anchor, main.head), Math.max(main.anchor, main.head)) +
      '@' +
      Math.min(main.anchor, main.head)
    )
  }
  return { wrapper, code, editor, textarea, selected }
}

describe('search in the editor', () => {
  it('opens with the selected word, steps through matches and closes', async () => {
    const { wrapper, editor, textarea, selected } = setup('foo bar foo\nfoo')
    editor.value!.select(0, 3)
    await keyOn(textarea, 'f', { ctrlKey: true })
    await nextTick()
    const find = wrapper.find<HTMLInputElement>('.dou-code-search__input')
    expect(find.element.value).toBe('foo')
    expect(wrapper.find('.dou-code-search__status').text()).toBe('1/3')
    expect(wrapper.findAll('.dou-code-editor__mark').length).toBeGreaterThan(0)
    await keyOn(find.element, 'Enter')
    expect(selected()).toBe('foo@8')
    await keyOn(find.element, 'Enter')
    expect(selected()).toBe('foo@12')
    await keyOn(find.element, 'Enter')
    expect(selected()).toBe('foo@0')
    await keyOn(find.element, 'Enter', { shiftKey: true })
    expect(selected()).toBe('foo@12')
    await keyOn(find.element, 'Escape')
    await nextTick()
    expect(wrapper.find('.dou-code-search').exists()).toBe(false)
    expect(document.activeElement).toBe(textarea)
  })

  it('selects the first match as the search is typed', async () => {
    const { wrapper, editor, selected } = setup('alpha beta\nbeta')
    editor.value!.select(6)
    editor.value!.openSearch()
    await nextTick()
    await fill(wrapper.find<HTMLInputElement>('.dou-code-search__input').element, 'beta')
    expect(selected()).toBe('beta@6')
    await fill(wrapper.find<HTMLInputElement>('.dou-code-search__input').element, 'zzz')
    expect(wrapper.find('.dou-code-search__status').text()).not.toBe('')
    expect(wrapper.findAll('.dou-code-editor__match').length).toBe(0)
  })

  it('replaces one match at a time, then all of them', async () => {
    const { wrapper, editor, code } = setup('a1 a2 a3')
    editor.value!.openSearch({ search: 'a(\\d)', regexp: true })
    await nextTick()
    await wrapper.find('.dou-code-search__expand').trigger('click')
    const [, replace] = wrapper.findAll<HTMLInputElement>('.dou-code-search__input')
    await fill(replace!.element, 'b$1')
    await keyOn(replace!.element, 'Enter')
    expect(code.value).toBe('b1 a2 a3')
    await keyOn(replace!.element, 'Enter', { ctrlKey: true })
    expect(code.value).toBe('b1 b2 b3')
    editor.value!.closeSearch()
  })

  it('has no replace box in a read-only editor', async () => {
    const { wrapper, editor } = setup('abc', { readonly: true })
    editor.value!.openSearch({ search: 'b' })
    await nextTick()
    expect(wrapper.find('.dou-code-search__expand').exists()).toBe(false)
    expect(wrapper.find('.dou-code-search__status').text()).toBe('1/1')
  })

  it('opens nothing with search turned off', async () => {
    const { wrapper, textarea } = setup('abc', { search: false })
    await keyOn(textarea, 'f', { ctrlKey: true })
    expect(wrapper.find('.dou-code-search').exists()).toBe(false)
  })
})
