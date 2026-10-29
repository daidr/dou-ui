import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouUpload } from '../../../index'
import type { UploadFile } from '../../../index'

const files: UploadFile[] = [
  { uid: '1', name: '外滩.png', size: 100, type: 'image/png', status: 'success', url: '/a.png' },
  { uid: '2', name: '报告.pdf', size: 100, type: 'application/pdf', status: 'success' },
  {
    uid: '3',
    name: '夜景.jpg',
    size: 100,
    type: 'image/jpeg',
    status: 'uploading',
    percent: 40,
    url: '/b.jpg',
  },
]

describe('DouUpload picture cards', () => {
  it('lays files out as cards with a trigger card last', () => {
    const wrapper = mount(DouUpload, { props: { modelValue: files, listType: 'picture-card' } })
    expect(wrapper.classes()).toContain('is-cards')
    expect(wrapper.findAll('.dou-upload__card')).toHaveLength(3)
    expect(wrapper.find('.dou-upload__card-image').attributes('src')).toBe('/a.png')
    expect(wrapper.find('.dou-upload__card-progress').text()).toContain('40')
    expect(wrapper.find('.dou-upload__card-trigger').exists()).toBe(true)
    expect(wrapper.find('.dou-upload__list').exists()).toBe(false)
  })

  it('hides the trigger card once full', () => {
    const wrapper = mount(DouUpload, {
      props: { modelValue: files, listType: 'picture-card', maxCount: 3 },
    })
    expect(wrapper.find('.dou-upload__card-trigger').exists()).toBe(false)
  })

  it('previews images and removes cards', async () => {
    const wrapper = mount(DouUpload, {
      props: { modelValue: files, listType: 'picture-card' },
      attachTo: document.body,
    })
    const first = wrapper.findAll('.dou-upload__card')[0]!
    const [preview, remove] = first.findAll('.dou-upload__card-action')
    await preview!.trigger('click')
    expect(wrapper.emitted('preview')?.[0]?.[0]).toMatchObject({ uid: '1' })
    expect(document.querySelector('.dou-image-preview')).not.toBeNull()
    // files without an image only offer remove
    expect(
      wrapper.findAll('.dou-upload__card')[1]!.findAll('.dou-upload__card-action'),
    ).toHaveLength(1)
    await remove!.trigger('click')
    expect(wrapper.emitted('remove')?.[0]?.[0]).toMatchObject({ uid: '1' })
    wrapper.unmount()
  })
})
