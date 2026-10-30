import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { defineBlock, EditorContent } from '../../define-block'
import DouEditor from '../../editor.vue'
import { starterKit } from '../../extensions/starter-kit'
import { defineExtension, resolveExtensions } from '../extension'
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
  type: 'callout',
  props: { tone: 'neutral' },
  component: CalloutView,
})

describe('resolveExtensions', () => {
  it('builds the schema from the extensions', () => {
    const kit = resolveExtensions([starterKit({ codeBlock: false })])
    expect(kit.schema.nodes.heading).toBeTruthy()
    expect(kit.schema.nodes.codeBlock).toBeUndefined()
    expect(kit.blockOptions.map((option) => option.key)).not.toContain('codeBlock')
  })

  it('refuses the same extension or block type twice', () => {
    expect(() => resolveExtensions([starterKit(), starterKit()])).toThrow(/added twice/)
    const another = defineExtension({ name: 'other', blocks: { heading: {} } })
    expect(() => resolveExtensions([starterKit(), another])).toThrow(/already defined/)
  })

  it('puts higher priority first', () => {
    const late = defineExtension({ name: 'late' })
    const early = defineExtension({ name: 'early', priority: 200 })
    const kit = resolveExtensions([late, early])
    expect(kit.extensions.map((extension) => extension.name)).toEqual(['early', 'late'])
  })
})

describe('defineBlock', () => {
  it('stores its props in the document, with defaults', () => {
    const { schema } = resolveExtensions([starterKit(), callout])
    const doc = blocksToDoc(schema, [
      { id: 'a', type: 'callout', content: 'Hi' },
      { id: 'b', type: 'callout', props: { tone: 'warning' } },
    ])
    expect(docToBlocks(doc).map((block) => [block.type, block.props])).toEqual([
      ['callout', { tone: 'neutral' }],
      ['callout', { tone: 'warning' }],
    ])
  })

  it('renders with its Vue component, the text inside EditorContent', async () => {
    const wrapper = mount(DouEditor, {
      attachTo: document.body,
      props: {
        extensions: [starterKit(), callout],
        modelValue: [{ id: 'a', type: 'callout', content: 'Hello' }],
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
