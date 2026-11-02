import { mount } from '@vue/test-utils'
import { DOMParser } from 'prosemirror-model'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { image, isSafeImageSrc } from '..'
import { resolveEditorExtensions } from '../../../core/extension'
import { blocksToDoc, docToBlocks, type EditorDocument } from '../../../core/model'
import DouEditor from '../../../editor.vue'
import { editorKit } from '../../editor-kit'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('image', () => {
  it('stores its props in the document', () => {
    const { schema } = resolveEditorExtensions([editorKit(), image()])
    const doc = blocksToDoc(schema, [
      {
        id: 'a',
        type: 'image',
        props: { src: 'https://example.com/a.png', width: 50, caption: '外滩' },
      },
    ])
    expect(docToBlocks(doc)[0]).toMatchObject({
      type: 'image',
      props: { src: 'https://example.com/a.png', alt: '', caption: '外滩', width: 50 },
      content: [],
    })
  })

  it('reads images from pasted HTML and drops unsafe ones', () => {
    const { schema } = resolveEditorExtensions([editorKit(), image()])
    const element = document.createElement('div')
    element.innerHTML =
      '<p>before</p><figure><img src="https://example.com/b.png" alt="b"><figcaption>说明</figcaption></figure>' +
      '<img src="javascript:alert(1)"><p>after</p>'
    const doc = DOMParser.fromSchema(schema).parse(element)
    const blocks = docToBlocks(doc)
    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'image', 'paragraph'])
    expect(blocks[1]!.props).toMatchObject({
      src: 'https://example.com/b.png',
      alt: 'b',
      caption: '说明',
    })
  })

  it('accepts web, relative and image data addresses only', () => {
    expect(isSafeImageSrc('https://example.com/a.png')).toBe(true)
    expect(isSafeImageSrc('/a.png')).toBe(true)
    expect(isSafeImageSrc('data:image/png;base64,AAAA')).toBe(true)
    expect(isSafeImageSrc('data:image/svg+xml,<svg/>')).toBe(true)
    expect(isSafeImageSrc('data:text/html,<p>')).toBe(false)
    expect(isSafeImageSrc('javascript:alert(1)')).toBe(false)
  })

  it('uploads a pasted file and shows it when done', async () => {
    let finish: ((src: string) => void) | undefined
    const upload = () => new Promise<string>((resolve) => (finish = resolve))
    const wrapper = mount(DouEditor, {
      attachTo: document.body,
      props: {
        extensions: [editorKit(), image({ upload })],
        modelValue: { version: 1, blocks: [{ id: 'a', content: '' }] },
      },
    })
    await nextTick()
    const surface = (wrapper.element as HTMLElement).querySelector<HTMLElement>(
      '.dou-editor__surface',
    )!
    const file = new File(['x'], 'shot.png', { type: 'image/png' })
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [file], getData: () => '', types: ['Files'] },
    })
    surface.dispatchEvent(event)
    await nextTick()
    let blocks = (wrapper.emitted('update:modelValue')!.at(-1)![0] as EditorDocument).blocks
    // the empty paragraph made room for the image; nothing is stored until the upload is done
    expect(blocks.map((block) => [block.type, block.props.src])).toEqual([['image', '']])
    expect(wrapper.element.querySelector('.dou-editor-image__status')).toBeTruthy()
    finish!('https://example.com/shot.png')
    await flush()
    await nextTick()
    blocks = (wrapper.emitted('update:modelValue')!.at(-1)![0] as EditorDocument).blocks
    expect(blocks[0]!.props.src).toBe('https://example.com/shot.png')
    expect(wrapper.element.querySelector('.dou-editor-image__status')).toBeNull()
    expect(wrapper.element.querySelector('img')!.getAttribute('src')).toBe(
      'https://example.com/shot.png',
    )
    wrapper.unmount()
  })
})
