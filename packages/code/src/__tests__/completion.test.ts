import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { matchCompletion } from '../completion/match'
import { parseSnippet } from '../completion/snippet'
import {
  type CodeCompletion,
  type CodeEditorExpose,
  type CodeExtension,
  DouCodeEditor,
  defineCodeExtension,
} from '../index'

function setup(extensions: CodeExtension[], initial = '') {
  const code = ref(initial)
  const editor = ref<CodeEditorExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouCodeEditor, {
          ref: editor,
          modelValue: code.value,
          'onUpdate:modelValue': (value: string) => (code.value = value),
          extensions,
        }),
    ),
    { attachTo: document.body },
  )
  const input = wrapper.find('textarea').element as HTMLTextAreaElement
  input.focus()
  const key = async (name: string, init: KeyboardEventInit = {}) => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
    )
    await nextTick()
  }
  const type = async (text: string) => {
    for (const char of text) {
      const start = input.selectionStart
      input.value = input.value.slice(0, start) + char + input.value.slice(input.selectionEnd)
      input.setSelectionRange(start + 1, start + 1)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()
    }
  }
  const labels = () =>
    wrapper.findAll('.dou-code-editor__completion-label').map((item) => item.text())
  const ranges = () => {
    const { ranges: list, main } = editor.value!.selection
    return { main, ranges: list.map((r) => [r.anchor, r.head]) }
  }
  return { wrapper, code, editor, input, key, type, labels, ranges }
}

const words: CodeCompletion[] = [
  { label: 'console', kind: 'variable' },
  { label: 'const', kind: 'keyword' },
  { label: 'constructor', kind: 'method', detail: '()' },
  { label: 'for', kind: 'snippet', snippet: 'for (let ${1:i} = 0; $1 < ${2:n}; $1++) {\n\t$0\n}' },
  { label: 'getElementById', kind: 'method', info: '按 id 找元素' },
]

const source = defineCodeExtension({
  name: 'words',
  completionTriggers: ['.'],
  completion: ({ word }) => ({ from: word.from, options: words }),
})

const call = defineCodeExtension({
  name: 'call',
  completion: ({ word }) => ({
    from: word.from,
    options: [{ label: 'max', snippet: 'max(${1:a}, ${2:b})' }],
  }),
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('matchCompletion', () => {
  it('ranks a prefix above a match at word starts, and fails when letters are missing', () => {
    const prefix = matchCompletion('console', 'con')!
    const starts = matchCompletion('getElementById', 'gebi')!
    expect(prefix.ranges).toEqual([[0, 3]])
    expect(prefix.score).toBeGreaterThan(starts.score)
    expect(starts.ranges).toEqual([
      [0, 2],
      [10, 11],
      [12, 13],
    ])
    expect(matchCompletion('console', 'cx')).toBeNull()
    expect(matchCompletion('Console', 'con')).not.toBeNull()
  })
})

describe('parseSnippet', () => {
  it('reads places in Tab order with $0 last, and escapes', () => {
    const { text, fields } = parseSnippet('f(${1:a}, ${2:b}) $0 \\$1 $1')
    expect(text).toBe('f(a, b)  $1 a')
    expect(fields.map((field) => [field.index, text.slice(field.from, field.to)])).toEqual([
      [1, 'a'],
      [1, 'a'],
      [2, 'b'],
      [0, ''],
    ])
  })
})

describe('completion', () => {
  it('opens while typing a word, narrows, and puts the picked entry in with Enter', async () => {
    const { wrapper, code, type, key, labels, input } = setup([source])
    await type('cons')
    await nextTick()
    expect(labels()).toEqual(['const', 'console', 'constructor'])
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-0$/)
    await key('ArrowDown')
    expect(wrapper.find('.dou-code-editor__completion.is-active').text()).toContain('console')
    await key('Enter')
    expect(code.value).toBe('console')
    expect(wrapper.find('.dou-code-editor__completions').exists()).toBe(false)
  })

  it('closes on Escape and on a character that is not part of a word', async () => {
    const { wrapper, type, key } = setup([source])
    await type('co')
    expect(wrapper.find('.dou-code-editor__completions').exists()).toBe(true)
    await key('Escape')
    expect(wrapper.find('.dou-code-editor__completions').exists()).toBe(false)
    await type('n')
    expect(wrapper.find('.dou-code-editor__completions').exists()).toBe(true)
    await type(' ')
    expect(wrapper.find('.dou-code-editor__completions').exists()).toBe(false)
  })

  it('opens after a trigger character and with Ctrl+Space, and shows the info of the picked entry', async () => {
    const { wrapper, type, key, labels } = setup([source], 'el')
    await type('.')
    expect(labels()).toHaveLength(words.length)
    await key('Escape')
    await key(' ', { ctrlKey: true })
    expect(labels()).toHaveLength(words.length)
    await key('ArrowUp')
    expect(wrapper.find('.dou-code-editor__completion-info').text()).toBe('按 id 找元素')
  })

  it('drops an answer that comes after the text moved on, and waits for slow sources', async () => {
    const pending: Array<(value: unknown) => void> = []
    const slow = defineCodeExtension({
      name: 'slow',
      completion: ({ word }) =>
        new Promise((resolve) => pending.push(() => resolve({ from: word.from, options: words }))),
    })
    const { type, labels } = setup([slow])
    await type('c')
    await type('o')
    pending[0]!(undefined)
    await new Promise((resolve) => setTimeout(resolve))
    expect(labels()).toEqual([])
    pending[1]!(undefined)
    await new Promise((resolve) => setTimeout(resolve))
    expect(labels()).toEqual(['const', 'console', 'constructor'])
  })

  it('opens with Alt+Esc too, since Ctrl+Space switches input methods on some systems', async () => {
    const { key, labels, editor } = setup([source], 'co')
    editor.value!.select(2)
    await key('Escape', { altKey: true })
    expect(labels()).toEqual(['const', 'console', 'constructor'])
  })

  it('goes on to the next place with Tab while typing in a snippet, unless an entry was picked', async () => {
    const { code, type, key, labels, ranges } = setup([source, call])
    await type('ma')
    await key('Enter')
    // Typing in the first place opens the list; Tab still moves on.
    await type('c')
    expect(labels().length).toBeGreaterThan(0)
    await key('Tab')
    expect(code.value).toBe('max(c, b)')
    expect(ranges().ranges).toEqual([[7, 8]])
    // Picked with the arrows: Tab puts the entry in.
    await type('co')
    await key('ArrowDown')
    await key('Tab')
    expect(code.value).toBe('max(c, console)')
  })

  it('ends a snippet without $0 after its last place, the cursor after it', async () => {
    const { code, type, key, ranges } = setup([call])
    await type('ma')
    await key('Enter')
    await key('Tab')
    expect(ranges().ranges).toEqual([[7, 8]])
    await key('Tab')
    expect(code.value).toBe('max(a, b)')
    expect(ranges().ranges).toEqual([[9, 9]])
  })

  it('fills in a snippet, its places selected with Tab and Shift+Tab', async () => {
    const { code, type, key, ranges, editor } = setup([source], '  ')
    editor.value!.select(2)
    await type('fo')
    await key('Enter')
    // A tab in the snippet indents the way the editor does.
    expect(code.value).toBe('  for (let i = 0; i < n; i++) {\n    \n  }')
    // All three i's selected together.
    expect(ranges().ranges).toEqual([
      [11, 12],
      [18, 19],
      [25, 26],
    ])
    await key('Tab')
    expect(ranges().ranges).toEqual([[22, 23]])
    await key('Tab', { shiftKey: true })
    expect(ranges().ranges).toHaveLength(3)
    await key('Tab')
    await key('Tab')
    expect(ranges().ranges).toEqual([[36, 36]])
    // The snippet is done: Tab indents again.
    await key('Tab')
    expect(code.value.split('\n')[1]).toBe(' '.repeat(6))
  })
})

describe('hover and parameter hints', () => {
  it('shows hover text for the word under the cursor with Mod+I', async () => {
    const { wrapper, key, editor } = setup(
      [
        defineCodeExtension({
          name: 'docs',
          hover: ({ pos }, { doc }) => {
            const text = doc.toString()
            return text.slice(pos - 3, pos) === 'max' || text.startsWith('max', pos)
              ? { from: 0, to: 3, content: '返回最大的数' }
              : null
          },
        }),
      ],
      'max(1, 2)',
    )
    editor.value!.focus()
    await key('i', { ctrlKey: true })
    await nextTick()
    const box = wrapper.find('.dou-code-editor__problems')
    expect(box.find('.dou-code-editor__hover').text()).toBe('返回最大的数')
    expect(box.attributes('aria-label')).toBe('说明')
    // Read out, since it was asked for from the keyboard.
    expect(wrapper.find('.dou-code-editor__live').text()).toContain('返回最大的数')
    await key('Escape')
    expect(wrapper.find('.dou-code-editor__problems').exists()).toBe(false)
  })

  it('shows parameter hints after an opening bracket and follows commas', async () => {
    const hints = defineCodeExtension({
      name: 'hints',
      signature: ({ pos }, { doc }) => {
        const before = doc.slice(0, pos)
        const open = before.lastIndexOf('max(')
        if (open < 0 || before.indexOf(')', open) >= 0) return null
        const active = before.slice(open).split(',').length - 1
        return {
          label: 'max(a: number, b: number)',
          params: [
            [4, 13],
            [15, 24],
          ],
          active,
        }
      },
    })
    const { wrapper, type } = setup([hints])
    await type('max(')
    const active = () => wrapper.find('.dou-code-editor__signature-active')
    expect(active().text()).toBe('a: number')
    await type('1,')
    expect(active().text()).toBe('b: number')
    await type('2)')
    expect(wrapper.find('.dou-code-editor__signature').exists()).toBe(false)
  })

  it('waits for a slow parameter hint, and aborts it when the cursor moves on', async () => {
    const signals: AbortSignal[] = []
    const answers: Array<() => void> = []
    const hints = defineCodeExtension({
      name: 'slow-hints',
      signature: ({ signal }) => {
        signals.push(signal)
        return new Promise((resolve) =>
          answers.push(() => resolve({ label: 'f(a)', params: [[2, 3]], active: 0 })),
        )
      },
    })
    const { wrapper, type } = setup([hints])
    await type('f(')
    expect(signals).toHaveLength(1)
    answers[0]!()
    await new Promise((resolve) => setTimeout(resolve))
    expect(wrapper.find('.dou-code-editor__signature-active').text()).toBe('a')
    await type('1')
    expect(signals[0]!.aborted).toBe(true)
  })
})
