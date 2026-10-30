import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { defineBlock, EditorContent } from '../../define-block'
import DouEditor from '../../editor.vue'
import { editorKit } from '../../extensions/editor-kit'
import { useEditorMessages } from '../../locale'
import { defineEditorExtension, resolveEditorExtensions, toEditorKey } from '../extension'
import { blocksToDoc, docToBlocks } from '../model'

const CalloutView = defineComponent({
  props: ['block', 'updateProps', 'selected', 'editable'],
  setup(props) {
    return () =>
      h('div', { class: 'callout', 'data-tone': props.block.props.tone }, [
        h(
          'button',
          { class: 'tone', onClick: () => props.updateProps({ tone: 'warning' }) },
          'tone',
        ),
        h(EditorContent),
      ])
  },
})

const callout = defineBlock({
  type: 'note',
  props: { tone: 'neutral' },
  component: CalloutView,
})

describe('resolveEditorExtensions', () => {
  it('builds the schema from the extensions', () => {
    const kit = resolveEditorExtensions([editorKit({ codeBlock: false })])
    expect(kit.schema.nodes.heading).toBeTruthy()
    expect(kit.schema.nodes.codeBlock).toBeUndefined()
    expect(kit.blockOptions.map((option) => option.key)).not.toContain('codeBlock')
  })

  it('refuses the same extension or block type twice', () => {
    expect(() => resolveEditorExtensions([editorKit(), editorKit()])).toThrow(/added twice/)
    const another = defineEditorExtension({ name: 'other', blocks: { heading: {} } })
    expect(() => resolveEditorExtensions([editorKit(), another])).toThrow(/already defined/)
  })

  it('puts higher priority first', () => {
    const late = defineEditorExtension({ name: 'late' })
    const early = defineEditorExtension({ name: 'early', priority: 200 })
    const kit = resolveEditorExtensions([late, early])
    expect(kit.extensions.map((extension) => extension.name)).toEqual(['early', 'late'])
  })
})

describe('defineBlock', () => {
  it('stores its props in the document, with defaults', () => {
    const { schema } = resolveEditorExtensions([editorKit(), callout])
    const doc = blocksToDoc(schema, [
      { id: 'a', type: 'note', content: 'Hi' },
      { id: 'b', type: 'note', props: { tone: 'warning' } },
    ])
    expect(docToBlocks(doc).map((block) => [block.type, block.props])).toEqual([
      ['note', { tone: 'neutral' }],
      ['note', { tone: 'warning' }],
    ])
  })

  it('renders with its Vue component, the text inside EditorContent', async () => {
    const wrapper = mount(DouEditor, {
      attachTo: document.body,
      props: {
        extensions: [editorKit(), callout],
        modelValue: [{ id: 'a', type: 'note', content: 'Hello' }],
      },
    })
    await nextTick()
    const element = wrapper.element.querySelector('.callout')!
    expect(element.getAttribute('data-tone')).toBe('neutral')
    expect(element.querySelector('.dou-editor__text')!.textContent).toBe('Hello')
    ;(element.querySelector('.tone') as HTMLButtonElement).click()
    await nextTick()
    const emitted = wrapper.emitted('update:modelValue')!.at(-1)![0] as { props: object }[]
    expect(emitted[0]!.props).toEqual({ tone: 'warning' })
    expect(wrapper.element.querySelector('.callout')!.getAttribute('data-tone')).toBe('warning')
    wrapper.unmount()
  })
})

describe('editor messages', () => {
  it('merges a partial override into nested groups', () => {
    let messages: ReturnType<typeof useEditorMessages> | undefined
    mount(
      defineComponent({
        setup() {
          messages = useEditorMessages({
            types: { paragraph: '段落文字' },
            callout: { tones: { tip: '窍门' } },
          })
          return () => null
        },
      }),
    )
    expect(messages!.value.types.paragraph).toBe('段落文字')
    expect(messages!.value.types.heading1).toBe('一级标题')
    expect(messages!.value.callout.tones.tip).toBe('窍门')
    expect(messages!.value.callout.tones.info).toBeTruthy()
    expect(messages!.value.callout.change).toBeTruthy()
  })
})

describe('extensions prop', () => {
  it('warns once when it changes after mount', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouEditor, { props: { extensions: [editorKit()] } })
    await wrapper.setProps({ extensions: [editorKit()] })
    await wrapper.setProps({ extensions: [editorKit()] })
    expect(warn.mock.calls.filter(([m]) => String(m).includes('`extensions`'))).toHaveLength(1)
    warn.mockRestore()
    wrapper.unmount()
  })
})

describe('toEditorKey', () => {
  it('turns useHotkey keys into ProseMirror key names', () => {
    expect(toEditorKey('mod+shift+h')).toBe('Mod-Shift-h')
    expect(toEditorKey('Shift+Tab')).toBe('Shift-Tab')
    expect(toEditorKey('enter')).toBe('Enter')
    expect(toEditorKey('mod+alt+1')).toBe('Mod-Alt-1')
    expect(toEditorKey('ctrl+space')).toBe('Ctrl-Space')
    expect(toEditorKey('alt+up')).toBe('Alt-ArrowUp')
    expect(toEditorKey('mod+shift+.')).toBe('Mod-Shift-.')
    expect(() => toEditorKey('g i')).toThrow('sequences')
  })

  it('hands extension keymaps to ProseMirror under its key names', () => {
    const { keymaps } = resolveEditorExtensions([editorKit()])
    const keys = keymaps.flatMap((bindings) => Object.keys(bindings))
    expect(keys).toEqual(expect.arrayContaining(['Mod-b', 'Mod-Shift-s', 'Mod-Alt-1', 'Shift-Tab']))
  })
})
