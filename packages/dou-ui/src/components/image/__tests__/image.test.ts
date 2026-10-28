import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouImage, DouImagePreview } from '../../../index'
import { clampScale, normalizePreview } from '../preview'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DouImage', () => {
  it('shows a placeholder until the picture loads', async () => {
    const wrapper = mount(DouImage, { props: { src: 'a.png', alt: '山', width: 120, height: 80 } })
    expect(wrapper.get('.dou-image').classes()).toContain('is-loading')
    expect(wrapper.get('.dou-image').attributes('style')).toContain('width: 120px')
    expect(wrapper.find('img').attributes('alt')).toBe('山')
    await wrapper.find('img').trigger('load')
    expect(wrapper.get('.dou-image').classes()).toContain('is-loaded')
    expect(wrapper.find('.dou-image__placeholder').exists()).toBe(false)
    expect(wrapper.emitted('load')).toHaveLength(1)
  })

  it('tries the fallback, then shows the error state', async () => {
    const wrapper = mount(DouImage, { props: { src: 'a.png', fallback: 'b.png', alt: '封面' } })
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('img').attributes('src')).toBe('b.png')
    expect(wrapper.emitted('error')).toBeUndefined()
    await wrapper.find('img').trigger('error')
    expect(wrapper.get('.dou-image').classes()).toContain('is-error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.dou-image__error').text()).toContain('封面')
    expect(wrapper.emitted('error')).toHaveLength(1)
  })

  it('opens the preview at its own place in the list', async () => {
    const wrapper = mount(DouImage, {
      props: { src: 'b.png', alt: '乙', preview: true, previewList: ['a.png', 'b.png', 'c.png'] },
      attachTo: document.body,
    })
    expect(wrapper.get('.dou-image').attributes('role')).toBeUndefined()
    await wrapper.find('img').trigger('load')
    expect(wrapper.get('.dou-image').attributes('role')).toBe('button')
    expect(wrapper.get('.dou-image').attributes('aria-haspopup')).toBe('dialog')
    await wrapper.get('.dou-image').trigger('keydown', { key: 'Enter' })
    await nextTick()
    const dialog = document.querySelector('.dou-image-preview')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.querySelector('img')!.getAttribute('src')).toBe('b.png')
    expect(dialog.querySelector('.dou-image-preview__counter')!.textContent).toBe('2 / 3')
    wrapper.unmount()
  })
})

describe('DouImagePreview', () => {
  it('normalizes sources and clamps scale', () => {
    expect(normalizePreview(['a', { src: 'b', alt: 'B' }])).toEqual([
      { src: 'a' },
      { src: 'b', alt: 'B' },
    ])
    expect(clampScale(10, 0.25, 4)).toBe(4)
    expect(clampScale(0.1, 0.25, 4)).toBe(0.25)
  })

  it('pages, zooms, rotates and resets from the keyboard', async () => {
    const wrapper = mount(DouImagePreview, {
      props: {
        open: true,
        images: ['a.png', 'b.png'],
        index: 0,
        'onUpdate:index': (v: number) => wrapper.setProps({ index: v }),
      },
      attachTo: document.body,
    })
    await nextTick()
    const root = document.querySelector<HTMLElement>('.dou-image-preview')!
    const press = async (key: string) => {
      root.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      await nextTick()
    }
    const prev = root.querySelector<HTMLButtonElement>('.dou-image-preview__nav.is-prev')!
    expect(prev.disabled).toBe(true)
    await press('ArrowRight')
    expect(wrapper.props('index')).toBe(1)
    expect(root.querySelector('.dou-image-preview__image')!.getAttribute('src')).toBe('b.png')
    await press('ArrowRight')
    expect(wrapper.props('index')).toBe(1)

    await press('+')
    await press('r')
    const image = () => root.querySelector<HTMLElement>('.dou-image-preview__image')!
    expect(image().style.transform).toContain('scale(1.25)')
    expect(image().style.transform).toContain('rotate(90deg)')
    expect(root.querySelector('.dou-image-preview__scale')!.textContent).toBe('125%')
    await press('0')
    expect(image().style.transform).toContain('scale(1)')
    expect(image().style.transform).toContain('rotate(0deg)')
    wrapper.unmount()
  })

  it('closes from the close button', async () => {
    const wrapper = mount(DouImagePreview, {
      props: { open: true, images: ['a.png'] },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.querySelector('.dou-image-preview__nav')).toBeNull()
    document.querySelector<HTMLButtonElement>('.dou-image-preview__close')!.click()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})
