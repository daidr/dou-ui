import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { collaboration } from '../collaboration'
import { type CodeEditorExpose, type CodeExtension, DouCodeEditor } from '../index'

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

/** Two people, each with their own document, kept in sync as a server would. */
function pair(start = 'const a = 1\nconst b = 2') {
  const docs = [new Y.Doc(), new Y.Doc()] as const
  docs[0].getText('code').insert(0, start)
  Y.applyUpdate(docs[1], Y.encodeStateAsUpdate(docs[0]))
  const awareness = docs.map((doc) => new Awareness(doc)) as [Awareness, Awareness]
  for (const [i, from] of docs.entries()) {
    const to = docs[1 - i]!
    from.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') Y.applyUpdate(to, update, 'remote')
    })
    awareness[i]!.on(
      'update',
      ({ added, updated, removed }: Record<string, number[]>, origin: unknown) => {
        if (origin === 'remote') return
        const update = encodeAwarenessUpdate(awareness[i]!, [...added!, ...updated!, ...removed!])
        applyAwarenessUpdate(awareness[1 - i]!, update, 'remote')
      },
    )
  }
  return { docs, awareness }
}

function open(extensions: CodeExtension[], initial = '') {
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
  wrappers.push(wrapper)
  const input = wrapper.find('textarea').element as HTMLTextAreaElement
  const type = async (text: string) => {
    input.focus()
    const start = input.selectionStart
    input.value = input.value.slice(0, start) + text + input.value.slice(input.selectionEnd)
    input.setSelectionRange(start + text.length, start + text.length)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }
  return { wrapper, code, editor, input, type }
}

describe('collaboration', () => {
  it('starts from the shared text and sends every change to the others', async () => {
    const { docs } = pair()
    const a = open([collaboration({ text: docs[0].getText('code') })], 'ignored')
    const b = open([collaboration({ text: docs[1].getText('code') })])
    await nextTick()
    expect(a.code.value).toBe('const a = 1\nconst b = 2')
    a.editor.value!.select(5)
    await a.type('x')
    expect(docs[1].getText('code').toString()).toBe('constx a = 1\nconst b = 2')
    expect(b.code.value).toBe('constx a = 1\nconst b = 2')
    // several cursors at once: written as one step, from the end
    b.editor.value!.select({
      ranges: [
        { anchor: 0, head: 0 },
        { anchor: 13, head: 13 },
      ],
      main: 0,
    })
    await b.type('// ')
    expect(a.code.value).toBe('// constx a = 1\n// const b = 2')
  })

  it("moves this user's cursor with the others' changes and keeps their menus", async () => {
    const { docs } = pair()
    const a = open([collaboration({ text: docs[0].getText('code') })])
    open([collaboration({ text: docs[1].getText('code') })])
    await nextTick()
    a.editor.value!.select(18)
    docs[1].getText('code').insert(0, '// 戴兜\n')
    await nextTick()
    expect(a.editor.value!.selection.ranges[0]!.head).toBe(24)
    // someone else's change is kept out of this user's undo
    expect(a.editor.value!.canUndo).toBe(false)
    expect(a.editor.value!.undo()).toBe(false)
    expect(a.code.value).toBe('// 戴兜\nconst a = 1\nconst b = 2')
  })

  it("undoes only this user's own changes, and puts the cursor back", async () => {
    const { docs } = pair('abc')
    const a = open([collaboration({ text: docs[0].getText('code') })])
    const b = open([collaboration({ text: docs[1].getText('code') })])
    await nextTick()
    a.editor.value!.select(3)
    await a.type('!')
    b.editor.value!.select(0)
    await b.type('>')
    expect(a.code.value).toBe('>abc!')
    expect(a.editor.value!.canUndo).toBe(true)
    a.editor.value!.select(0)
    expect(a.editor.value!.undo()).toBe(true)
    await nextTick()
    expect(a.code.value).toBe('>abc')
    expect(b.code.value).toBe('>abc')
    // back where the change was made: after "c", moved by the other's ">"
    expect(a.editor.value!.selection.ranges[0]!.head).toBe(4)
    expect(a.editor.value!.canRedo).toBe(true)
    expect(a.editor.value!.redo()).toBe(true)
    await nextTick()
    expect(b.code.value).toBe('>abc!')
  })

  it('writes a new v-model value into the shared text', async () => {
    const { docs } = pair('one')
    const a = open([collaboration({ text: docs[0].getText('code') })])
    await nextTick()
    a.code.value = 'one two'
    await nextTick()
    await nextTick()
    expect(docs[1].getText('code').toString()).toBe('one two')
  })

  it("shows the others' cursors and selections with their names", async () => {
    const { docs, awareness } = pair()
    const a = open([
      collaboration({
        text: docs[0].getText('code'),
        awareness: awareness[0],
        user: { name: '戴兜', color: '#3b6ea8' },
      }),
    ])
    const b = open([
      collaboration({
        text: docs[1].getText('code'),
        awareness: awareness[1],
        user: { name: '阿青' },
      }),
    ])
    await nextTick()
    a.editor.value!.select(18, 23)
    await nextTick()
    await nextTick()
    const peer = b.wrapper.find('.dou-code-peer')
    expect(peer.exists()).toBe(true)
    expect(peer.attributes('aria-hidden')).toBe('true')
    expect(peer.text()).toBe('戴兜')
    expect((peer.element as HTMLElement).style.getPropertyValue('--dou-code-peer-color')).toBe(
      '#3b6ea8',
    )
    expect(b.wrapper.find('.dou-code-peer-selection').text()).toBe('b = 2')
    // the cursor follows the text, also when someone else changes it
    docs[1].getText('code').insert(12, 'let ')
    await nextTick()
    expect(b.wrapper.find('.dou-code-peer-selection').text()).toBe('b = 2')
    // on the first line the name goes below
    a.editor.value!.select(2)
    await nextTick()
    await nextTick()
    expect(b.wrapper.find('.dou-code-peer').classes()).toContain('is-below')
    // gone once the editor is
    a.wrapper.unmount()
    wrappers.splice(wrappers.indexOf(a.wrapper), 1)
    await nextTick()
    expect(b.wrapper.find('.dou-code-peer').exists()).toBe(false)
  })

  it('keeps a composition in the right place when the text changes meanwhile', async () => {
    const { docs } = pair('ab')
    const a = open([collaboration({ text: docs[0].getText('code') })])
    await nextTick()
    a.input.focus()
    a.editor.value!.select(1)
    await nextTick()
    a.input.dispatchEvent(new CompositionEvent('compositionstart'))
    a.input.value = 'anib'
    a.input.dispatchEvent(new Event('input'))
    // someone types at the start of the line while the input method is open
    docs[1].getText('code').insert(0, 'xy')
    await nextTick()
    expect(a.wrapper.find('.dou-code-editor__compose').text()).toBe('ni')
    a.input.value = 'a你b'
    a.input.dispatchEvent(new Event('input'))
    a.input.dispatchEvent(new CompositionEvent('compositionend', { data: '你' }))
    await nextTick()
    expect(a.code.value).toBe('xya你b')
    expect(docs[1].getText('code').toString()).toBe('xya你b')
  })

  it('warns when the shared text is empty but the editor is not', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const doc = new Y.Doc()
    const a = open([collaboration({ text: doc.getText('code') })], 'local only')
    expect(a.code.value).toBe('')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('shared text is empty'))
    warn.mockRestore()
  })
})
