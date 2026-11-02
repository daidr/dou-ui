import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  type CodeDiagnostic,
  type CodeEditorExpose,
  type CodeExtension,
  DouCodeEditor,
  defineCodeExtension,
  useCodeEditor,
} from '../index'

const source = ['var a = 1', 'const b = 2', '// TODO: c'].join('\n')

function setup(extensions: CodeExtension[], extra: Record<string, unknown> = {}, initial = source) {
  const code = ref(initial)
  const editor = ref<CodeEditorExpose>()
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(DouCodeEditor, {
          ref: editor,
          // Measured boxes in the frame: the test page has no layout to place them above.
          teleport: false,
          modelValue: code.value,
          'onUpdate:modelValue': (value: string) => (code.value = value),
          extensions,
          ...extra,
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
  return { wrapper, code, editor, input, key }
}

/** Finds each `var` as a warning, with a fix. */
const noVar = defineCodeExtension({
  name: 'no-var',
  lint: ({ doc }) => {
    const out: CodeDiagnostic[] = []
    const text = doc.toString()
    for (const match of text.matchAll(/\bvar\b/g))
      out.push({
        from: match.index!,
        to: match.index! + 3,
        severity: 'warning',
        message: 'no var',
        source: 'demo',
        actions: [
          {
            label: 'let',
            run: (ctx, d) => ctx.transact((tr) => tr.replace(d.from, d.to, 'let')),
          },
        ],
      })
    return out
  },
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('extensions', () => {
  it('draws mark and line decorations from the lines in view', async () => {
    const { wrapper, editor } = setup([
      defineCodeExtension({
        name: 'todo',
        decorations: ({ doc, visible }) => {
          expect(visible.from).toBe(1)
          const text = doc.toString()
          const at = text.indexOf('TODO')
          return [
            { type: 'mark', from: at, to: at + 4, class: 'is-todo', title: 'todo' },
            { type: 'line', line: 2, class: 'is-tinted' },
          ]
        },
      }),
    ])
    await nextTick()
    const todo = wrapper.find('.is-todo')
    expect(todo.text()).toBe('TODO')
    expect(todo.attributes('title')).toBe('todo')
    const lines = wrapper.findAll('.dou-code-editor__line')
    expect(lines[1]!.classes()).toContain('is-tinted')
    // Decorations follow the text.
    editor.value!.transact((tr) => tr.insert(0, '// TODO\n'))
    await nextTick()
    expect(wrapper.findAll('.is-todo').map((el) => el.text())).toEqual(['TODO'])
  })

  it('lints on mount, moves problems with edits and lints again later', async () => {
    vi.useFakeTimers()
    const lint = vi.fn<NonNullable<CodeExtension['lint']>>(noVar.lint!)
    const { wrapper, editor } = setup([{ ...noVar, lint }])
    await nextTick()
    expect(lint).toHaveBeenCalledTimes(1)
    expect(editor.value!.diagnostics.map((d) => [d.from, d.to])).toEqual([[0, 3]])
    expect(wrapper.find('.dou-code-editor__problem.is-warning').text()).toBe('var')
    expect(wrapper.findAll('.dou-code-editor__problem-icon').length).toBe(1)
    editor.value!.transact((tr) => tr.insert(0, '\n\n'))
    await nextTick()
    // Moved with the text before the next run.
    expect(editor.value!.diagnostics.map((d) => [d.from, d.to])).toEqual([[2, 5]])
    expect(lint).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(400)
    await nextTick()
    expect(lint).toHaveBeenCalledTimes(2)
  })

  it('drops a lint answer that comes back after the text changed', async () => {
    vi.useFakeTimers()
    let resolve!: (list: CodeDiagnostic[]) => void
    const { editor } = setup([
      { name: 'slow', lint: () => new Promise<CodeDiagnostic[]>((r) => (resolve = r)) },
    ])
    await nextTick()
    editor.value!.transact((tr) => tr.insert(0, 'x'))
    resolve([{ from: 0, to: 1, severity: 'error', message: 'stale' }])
    await Promise.resolve()
    await nextTick()
    expect(editor.value!.diagnostics).toEqual([])
  })

  it('shows the diagnostics prop, mapped through edits', async () => {
    const { editor } = setup([], {
      diagnostics: [
        { from: 10, to: 15, severity: 'info', message: 'b' },
        { from: 0, to: 3, severity: 'error', message: 'a' },
      ],
    })
    await nextTick()
    expect(editor.value!.diagnostics.map((d) => d.message)).toEqual(['a', 'b'])
    editor.value!.transact((tr) => tr.insert(5, 'xx'))
    await nextTick()
    expect(editor.value!.diagnostics.map((d) => d.from)).toEqual([0, 12])
  })

  it('goes to the next problem with F8 and fixes it with Mod+. from the keyboard', async () => {
    const { wrapper, editor, key, code } = setup([noVar], {}, 'const a = 1\nvar b = 2')
    await nextTick()
    editor.value!.select(0)
    await key('F8')
    expect(editor.value!.selection.ranges[0]).toEqual({ anchor: 12, head: 12 })
    expect(wrapper.find('.dou-code-editor__live').text()).toBe('第 2 行，警告：no var')
    expect(wrapper.find('.dou-code-editor__problems').exists()).toBe(true)
    await key('Escape')
    expect(wrapper.find('.dou-code-editor__problems').exists()).toBe(false)
    await key('.', { ctrlKey: true })
    expect(wrapper.find('.dou-code-editor__fix.is-active').text()).toBe('let')
    expect(wrapper.find('.dou-code-editor__live').text()).toBe('let，第 1 项，共 1 项')
    await key('ArrowDown')
    expect(wrapper.find('.dou-code-editor__fix.is-active').attributes('aria-current')).toBe('true')
    await key('Enter')
    expect(code.value).toBe('const a = 1\nlet b = 2')
    expect(wrapper.find('.dou-code-editor__problems').exists()).toBe(false)
  })

  it('runs a fix pressed in the problem box', async () => {
    const { wrapper, editor, key, code } = setup([noVar])
    await nextTick()
    editor.value!.select(1)
    await key('.', { ctrlKey: true })
    const fix = wrapper.find('.dou-code-editor__fix')
    expect(wrapper.find('.dou-code-editor__problem-source').text()).toBe('demo')
    await fix.trigger('click')
    expect(code.value.startsWith('let a')).toBe(true)
  })

  it('shows the problems under a tap, and leaves the box open when the finger lifts', async () => {
    const { wrapper } = setup([noVar])
    await nextTick()
    const content = wrapper.find('.dou-code-editor__content')
    // Cells are 8px wide and lines 20px high, inside 12px and 8px of padding.
    const point = {
      pointerType: 'touch',
      pointerId: 1,
      button: 0,
      clientX: 12 + 8 + 2,
      clientY: 18,
    }
    await content.trigger('pointerdown', point)
    await content.trigger('pointerup', point)
    await content.trigger('pointerleave', point)
    expect(wrapper.find('.dou-code-editor__problems').exists()).toBe(true)
  })

  it("shows a line's problems on a tap on its icon in the gutter, and puts them away on a press elsewhere", async () => {
    const { wrapper } = setup([noVar])
    await nextTick()
    const icon = wrapper.find('.dou-code-editor__problem-icon')
    expect(icon.exists()).toBe(true)
    const point = { pointerType: 'touch', pointerId: 1, button: 0, clientX: 4, clientY: 18 }
    const focus = vi.spyOn(HTMLTextAreaElement.prototype, 'focus')
    await icon.trigger('pointerdown', point)
    await icon.trigger('pointerup', point)
    expect(wrapper.find('.dou-code-editor__problems').exists()).toBe(true)
    // Showing it neither selects the line nor brings the keyboard up.
    expect(wrapper.find('.dou-code-editor__menu').exists()).toBe(false)
    expect(focus).not.toHaveBeenCalled()
    focus.mockRestore()
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('.dou-code-editor__problems').exists()).toBe(false)
    // A mouse click on it shows it at once.
    await icon.trigger('pointerdown', { ...point, pointerType: 'mouse' })
    expect(wrapper.find('.dou-code-editor__problems').exists()).toBe(true)
  })

  it('draws gutter markers and passes presses on them', async () => {
    const marked = ref(new Set<number>())
    const { wrapper } = setup([
      defineCodeExtension({
        name: 'breakpoint',
        gutters: [
          {
            name: 'breakpoint',
            markers: () => [...marked.value].map((line) => ({ line, text: '●', title: 'stop' })),
            onPress: (line) => {
              const next = new Set(marked.value)
              if (next.has(line)) next.delete(line)
              else next.add(line)
              marked.value = next
            },
          },
        ],
      }),
    ])
    await nextTick()
    const cell = () => wrapper.find('[data-gutter-cell][data-line="2"]')
    await cell().trigger('pointerdown', { button: 0, pointerType: 'mouse' })
    expect([...marked.value]).toEqual([2])
    expect(cell().text()).toBe('●')
    expect(cell().attributes('title')).toBe('stop')
    await cell().trigger('pointerdown', { button: 0, pointerType: 'mouse' })
    expect(cell().text()).toBe('')
  })

  it('draws panels that reach the editor with useCodeEditor', async () => {
    const Count = defineComponent(() => {
      const editor = useCodeEditor()
      return () => h('span', { class: 'count' }, String(editor.doc.lines))
    })
    const { wrapper, editor } = setup([
      defineCodeExtension({
        name: 'status',
        panels: () => [
          { name: 'top', position: 'top', render: () => h('b', 'top') },
          { name: 'bottom', render: () => h(Count) },
        ],
      }),
    ])
    await nextTick()
    const panels = wrapper.findAll('.dou-code-editor__panels')
    expect(panels.map((p) => p.text())).toEqual(['top', '3'])
    editor.value!.transact((tr) => tr.insert(0, '\n'))
    await nextTick()
    expect(wrapper.find('.count').text()).toBe('4')
  })

  it('makes room between lines for widgets, and keeps presses inside them to themselves', async () => {
    const { wrapper, editor } = setup([
      defineCodeExtension({
        name: 'review',
        widgets: () => [
          {
            id: 'a',
            line: 1,
            height: 50,
            label: 'review',
            render: () => h('button', { class: 'resolve' }, 'ok'),
          },
          // Given by a position on line 3.
          { id: 'b', pos: 23, position: 'above', height: 30, render: () => h('i', 'above') },
        ],
      }),
    ])
    await nextTick()
    const shown = wrapper.findAll('.dou-code-editor__widget')
    expect(shown.map((w) => w.text())).toEqual(['ok', 'above'])
    // Below line 1: the text's top (8) plus one line; above line 3: past both lines and the first widget.
    expect(shown[0]!.attributes('style')).toContain('28px)')
    expect(shown[1]!.attributes('style')).toContain(`${8 + 40 + 50}px)`)
    const lines = wrapper.findAll('.dou-code-editor__line')
    expect(lines[1]!.attributes('style')).toContain('margin-top: 50px')
    expect(lines[2]!.attributes('style')).toContain('margin-top: 30px')
    expect(wrapper.findAll('.dou-code-editor__number')[1]!.attributes('style')).toContain(
      'margin-top: 50px',
    )
    // A press below the first widget lands on line 2.
    const content = wrapper.find('.dou-code-editor__content')
    await content.trigger('pointerdown', {
      button: 0,
      pointerType: 'mouse',
      clientX: 12 + 2 * 8 + 2,
      clientY: 8 + 20 + 50 + 10,
    })
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    expect(editor.value!.selection.ranges[0]!.head).toBe(10 + 2)
    expect(shown[0]!.attributes('aria-label')).toBe('review')
    // Moving onto line 1, the widget's label is read out.
    editor.value!.select(0)
    await nextTick()
    await nextTick()
    expect(wrapper.find('.dou-code-editor__live').text()).toBe('review')
    // Inside a widget, nothing moves.
    await wrapper.find('.resolve').trigger('pointerdown', { button: 0, pointerType: 'mouse' })
    expect(editor.value!.selection.ranges[0]!.head).toBe(0)
  })

  it('places inline widgets in the line, with the cursor stepping over them', async () => {
    const { wrapper, editor, key } = setup(
      [
        defineCodeExtension({
          name: 'swatch',
          decorations: () => [
            { type: 'inline', pos: 4, width: 16, render: () => h('b', { class: 'swatch' }) },
          ],
        }),
      ],
      {},
      'var a = 1',
    )
    await nextTick()
    const line = wrapper.find('.dou-code-editor__line')
    expect(line.text()).toBe('var a = 1')
    expect(line.find('.dou-code-editor__inline .swatch').exists()).toBe(true)
    // Before the swatch, then after it at the same position, then one character on.
    const left = () =>
      Number(
        /translate\((\d+(?:\.\d+)?)px/.exec(
          wrapper.find('.dou-code-editor__cursor').attributes('style')!,
        )![1],
      )
    editor.value!.select(3)
    await nextTick()
    const before = left()
    await key('ArrowRight')
    expect(editor.value!.selection.ranges[0]!.head).toBe(4)
    expect(left() - before).toBe(8 + 16)
    await key('ArrowRight')
    expect(left() - before).toBe(16 + 16)
    // A press past the swatch counts its width.
    const content = wrapper.find('.dou-code-editor__content')
    await content.trigger('pointerdown', {
      button: 0,
      pointerType: 'mouse',
      clientX: 12 + 6 * 8 + 16 + 2,
      clientY: 18,
    })
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    expect(editor.value!.selection.ranges[0]!.head).toBe(6)
  })

  it('throws when useCodeEditor is used outside an editor', () => {
    const Lost = defineComponent(() => {
      useCodeEditor()
      return () => null
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => mount(Lost)).toThrow('inside a DouCodeEditor')
    warn.mockRestore()
  })

  it('lets transaction hooks add to a change, by priority', async () => {
    const order: string[] = []
    const { editor, code } = setup(
      [
        { name: 'low', transaction: () => void order.push('low') },
        {
          name: 'high',
          priority: 200,
          transaction: (tr) => {
            order.push('high')
            if (tr.docChanged) tr.insert(tr.doc.length, ';')
          },
        },
      ],
      {},
      'a',
    )
    editor.value!.transact((tr) => tr.insert(1, 'b'))
    await nextTick()
    expect(code.value).toBe('ab;')
    expect(order).toEqual(['high', 'low'])
    // Undo comes back as it was, without the hooks.
    order.length = 0
    editor.value!.undo()
    await nextTick()
    expect(code.value).toBe('a')
    expect(order).toEqual([])
  })

  it('sets up extensions on mount and cleans up on unmount', async () => {
    const calls: string[] = []
    const { wrapper } = setup([
      {
        name: 'life',
        setup: (ctx) => {
          calls.push(`setup ${ctx.doc.lines}`)
          return () => calls.push('cleanup')
        },
      },
    ])
    await nextTick()
    expect(calls).toEqual(['setup 3'])
    wrapper.unmount()
    expect(calls).toEqual(['setup 3', 'cleanup'])
  })

  it('tries extension keys after the keymap prop, higher priority first', async () => {
    const hits: string[] = []
    const bind = (name: string, priority?: number): CodeExtension => ({
      name,
      priority,
      keymap: () => ({ 'mod+k': () => (hits.push(name), true) }),
    })
    const { key } = setup([bind('low', 50), bind('high', 150)])
    await key('k', { ctrlKey: true })
    expect(hits).toEqual(['high'])
    const prop = setup([bind('ext')], {
      keymap: { 'mod+k': () => (hits.push('prop'), true) },
    })
    await prop.key('k', { ctrlKey: true })
    expect(hits).toEqual(['high', 'prop'])
  })
})
