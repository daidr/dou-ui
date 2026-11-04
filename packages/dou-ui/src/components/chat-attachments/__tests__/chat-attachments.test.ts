import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouChatAttachments } from '../../../index'
import { attachmentKind, fileExtension } from '../chat-attachments'
import type { ChatAttachment } from '../chat-attachments'

const files: ChatAttachment[] = [
  { uid: '1', name: '周报.pdf', size: 2048 },
  { uid: '2', name: '截图.png', type: 'image/png', url: 'shot.png' },
  { uid: '3', name: '数据.csv', status: 'running', percent: 40 },
  { uid: '4', name: '草稿.md', status: 'error' },
]

describe('DouChatAttachments', () => {
  it('lists files and thumbnails', () => {
    const wrapper = mount(DouChatAttachments, { props: { modelValue: files } })
    const items = wrapper.findAll('.dou-chat-attachments__item')
    expect(wrapper.attributes('aria-label')).toBe('附件')
    expect(items[0]!.get('.dou-chat-attachments__detail').text()).toBe('PDF · 2 KB')
    expect(items[1]!.classes()).toContain('is-thumb')
    expect(items[1]!.get('img').attributes('src')).toBe('shot.png')
    expect(items[2]!.get('.dou-chat-attachments__detail').text()).toBe('上传中 40%')
    expect(items[2]!.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('40')
    expect(items[3]!.classes()).toContain('is-error')
    expect(items[3]!.get('.dou-chat-attachments__detail').text()).toBe('上传失败')
  })

  it('removes and opens files', async () => {
    const wrapper = mount(DouChatAttachments, { props: { modelValue: files } })
    await wrapper.get('.dou-chat-attachments__remove').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[files.slice(1)]])
    expect(wrapper.emitted('remove')).toEqual([[files[0]]])
    await wrapper.get('.dou-chat-attachments__main').trigger('click')
    expect(wrapper.emitted('open')).toEqual([[files[0]]])
  })

  it('hides the remove button when not removable', () => {
    const wrapper = mount(DouChatAttachments, { props: { modelValue: files, removable: false } })
    expect(wrapper.find('.dou-chat-attachments__remove').exists()).toBe(false)
  })

  it('tells file kinds apart', () => {
    expect(attachmentKind({ name: 'a.ZIP' })).toBe('archive')
    expect(attachmentKind({ name: 'a', type: 'video/mp4' })).toBe('video')
    expect(attachmentKind({ name: 'a.unknown', type: 'text/x-foo' })).toBe('text')
    expect(attachmentKind({ name: 'noext' })).toBe('file')
    expect(fileExtension('.env')).toBe('')
  })
})
