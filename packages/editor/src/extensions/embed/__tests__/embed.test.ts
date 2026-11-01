import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { embed, resolveEmbed } from '..'
import { blocksToHTML, htmlToBlocks } from '../../../core/convert'
import type { Block } from '../../../core/model'
import DouEditor from '../../../editor.vue'
import { blocksToMarkdown } from '../../../markdown'
import { editorKit } from '../../editor-kit'

const extensions = [editorKit(), embed()]

describe('embed', () => {
  it('shows media files in the player and other https pages in a frame', () => {
    expect(resolveEmbed('https://example.com/map')).toEqual({
      kind: 'frame',
      src: 'https://example.com/map',
    })
    expect(resolveEmbed('https://example.com/a.MP4')).toMatchObject({ kind: 'video' })
    expect(resolveEmbed('https://example.com/a.mp3?x=1')).toMatchObject({ kind: 'audio' })
    expect(resolveEmbed('http://example.com/map')).toBeNull()
    expect(resolveEmbed('javascript:alert(1)')).toBeNull()
    expect(resolveEmbed(`${location.origin}/page`)).toBeNull()
  })

  it('writes a sandboxed frame and reads the link back', () => {
    const blocks = [
      { type: 'embed', props: { src: 'https://example.com/map', caption: '上海地图' } },
    ]
    const html = blocksToHTML(blocks, extensions)
    expect(html).toContain(
      '<figure data-embed="https://example.com/map"><iframe src="https://example.com/map"',
    )
    expect(html).toContain('sandbox="allow-scripts')
    expect(html).toContain('<figcaption>上海地图</figcaption>')
    expect(htmlToBlocks(html, extensions)[0]).toMatchObject({
      type: 'embed',
      props: { src: 'https://example.com/map', caption: '上海地图' },
    })
    expect(blocksToMarkdown(blocks, extensions)).toBe('[上海地图](https://example.com/map)\n')
  })

  it('reads frames and players pasted from a page, https only', () => {
    const blocks = htmlToBlocks(
      '<iframe src="https://example.com/p"></iframe><video src="https://example.com/v.webm"></video><iframe src="http://example.com/p"></iframe>',
      extensions,
    )
    expect(
      blocks.filter((block) => block.type === 'embed').map((block) => block.props.src),
    ).toEqual(['https://example.com/p', 'https://example.com/v.webm'])
  })

  it('keeps the link and lets a resolver choose what to show', () => {
    const custom = [
      editorKit(),
      embed({
        resolve: (url) => {
          const id = /^https:\/\/video\.example\.com\/watch\/(\w+)$/.exec(url)?.[1]
          if (id)
            return {
              kind: 'frame',
              src: `https://video.example.com/player/${id}`,
              aspectRatio: 4 / 3,
            }
          // only https is ever loaded, whatever the resolver says
          if (url.includes('unsafe')) return { kind: 'frame', src: 'http://example.com/' }
          return null
        },
      }),
    ]
    const html = blocksToHTML(
      [{ type: 'embed', props: { src: 'https://video.example.com/watch/abc' } }],
      custom,
    )
    expect(html).toContain('data-embed="https://video.example.com/watch/abc"')
    expect(html).toContain('<iframe src="https://video.example.com/player/abc"')
    expect(html).toContain(`aspect-ratio: ${4 / 3}`)
    expect(
      blocksToHTML([{ type: 'embed', props: { src: 'https://unsafe.example.com/' } }], custom),
    ).toBe('')
    expect(
      blocksToHTML([{ type: 'embed', props: { src: 'https://other.example.com/' } }], custom),
    ).toBe('')
  })

  it('takes a link in the empty block and refuses one it cannot embed', async () => {
    const wrapper = mount(DouEditor, {
      attachTo: document.body,
      props: { extensions, modelValue: [{ id: 'e', type: 'embed' }] },
    })
    await nextTick()
    const input = wrapper.find('.dou-editor-embed input')
    await input.setValue('http://example.com/map')
    await wrapper.find('.dou-editor-embed form').trigger('submit')
    expect(wrapper.find('.dou-editor-embed__error').text()).toBe('无法嵌入这个链接')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await input.setValue('https://example.com/map')
    expect(wrapper.find('.dou-editor-embed__error').exists()).toBe(false)
    await wrapper.find('.dou-editor-embed form').trigger('submit')
    await nextTick()
    const blocks = wrapper.emitted('update:modelValue')!.at(-1)![0] as Block[]
    expect(blocks[0]!.props.src).toBe('https://example.com/map')
    const frame = wrapper.find('.dou-editor-embed iframe')
    expect(frame.attributes('src')).toBe('https://example.com/map')
    expect(frame.attributes('sandbox')).toContain('allow-scripts')
    wrapper.unmount()
  })
})
