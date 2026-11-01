import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { attachment, formatFileSize, isSafeFileSrc } from '..'
import { blocksToHTML, htmlToBlocks } from '../../../core/convert'
import type { Block, PartialBlock } from '../../../core/model'
import DouEditor from '../../../editor.vue'
import { blocksToMarkdown } from '../../../markdown'
import { editorKit } from '../../editor-kit'
import { image } from '../../image'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const extensions = [editorKit(), attachment()]

const file: PartialBlock = {
  id: 'f',
  type: 'attachment',
  props: {
    src: 'https://example.com/报告.pdf',
    name: '报告.pdf',
    size: 1258291,
    mime: 'application/pdf',
  },
}

function paste(surface: HTMLElement, files: File[]) {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', {
    value: { files, getData: () => '', types: ['Files'] },
  })
  surface.dispatchEvent(event)
}

describe('attachment', () => {
  it('writes a download link and reads it back', () => {
    const html = blocksToHTML([file], extensions)
    expect(html).toBe(
      '<p><a href="https://example.com/报告.pdf" download="报告.pdf" data-attachment data-size="1258291" data-mime="application/pdf">报告.pdf</a> (1.2 MB)</p>',
    )
    expect(htmlToBlocks(html, extensions)[0]).toMatchObject({
      type: 'attachment',
      props: file.props,
    })
    expect(blocksToMarkdown([file], extensions)).toBe('[报告.pdf](https://example.com/报告.pdf)\n')
  })

  it('drops addresses that could run script', () => {
    expect(isSafeFileSrc('javascript:alert(1)')).toBe(false)
    expect(isSafeFileSrc(' java\tscript:alert(1)')).toBe(false)
    expect(isSafeFileSrc('data:application/pdf;base64,AAAA')).toBe(true)
    expect(isSafeFileSrc('/files/a.zip')).toBe(true)
    const blocks = htmlToBlocks('<a data-attachment href="javascript:alert(1)">x</a>', extensions)
    expect(blocks.some((block) => block.type === 'attachment')).toBe(false)
    expect(
      blocksToHTML(
        [{ type: 'attachment', props: { src: 'javascript:alert(1)', name: 'x' } }],
        extensions,
      ),
    ).toBe('')
  })

  it('formats sizes', () => {
    expect(formatFileSize(12)).toBe('12 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(340 * 1024)).toBe('340 KB')
    expect(formatFileSize('')).toBe('')
  })

  it('uploads a pasted file, and leaves images to the image block', async () => {
    let finish: ((src: string) => void) | undefined
    const upload = () => new Promise<string>((resolve) => (finish = resolve))
    const wrapper = mount(DouEditor, {
      attachTo: document.body,
      props: {
        extensions: [
          editorKit(),
          image({ upload: async () => 'https://example.com/a.png' }),
          attachment({ upload }),
        ],
        modelValue: [{ id: 'a', content: '' }],
      },
    })
    await nextTick()
    const surface = (wrapper.element as HTMLElement).querySelector<HTMLElement>(
      '.dou-editor__surface',
    )!
    paste(surface, [new File(['%PDF'], '方案.pdf', { type: 'application/pdf' })])
    await nextTick()
    let blocks = wrapper.emitted('update:modelValue')!.at(-1)![0] as Block[]
    expect(blocks[0]).toMatchObject({
      type: 'attachment',
      props: { src: '', name: '方案.pdf', size: 4, mime: 'application/pdf' },
    })
    expect(wrapper.element.querySelector('.dou-editor-attachment__meta')!.textContent).toContain(
      '上传',
    )
    finish!('https://example.com/方案.pdf')
    await flush()
    await nextTick()
    blocks = wrapper.emitted('update:modelValue')!.at(-1)![0] as Block[]
    expect(blocks[0]!.props.src).toBe('https://example.com/方案.pdf')
    const link = (wrapper.element as HTMLElement).querySelector<HTMLAnchorElement>(
      '.dou-editor-attachment__download',
    )!
    expect(link.getAttribute('href')).toBe('https://example.com/方案.pdf')
    expect(link.getAttribute('download')).toBe('方案.pdf')

    paste(surface, [new File(['x'], 'shot.png', { type: 'image/png' })])
    await flush()
    await nextTick()
    blocks = wrapper.emitted('update:modelValue')!.at(-1)![0] as Block[]
    expect(blocks.map((block) => block.type)).toContain('image')
    wrapper.unmount()
  })
})
