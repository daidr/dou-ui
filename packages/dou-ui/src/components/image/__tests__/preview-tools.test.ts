import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouImage, DouImagePreview } from '../../../index'
import { downloadImage } from '../preview'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('DouImagePreview tools', () => {
  it('mirrors along the screen axes, from the toolbar or with H and V', async () => {
    const wrapper = mount(DouImagePreview, {
      props: { open: true, images: ['a.png'] },
      attachTo: document.body,
    })
    await nextTick()
    const root = document.querySelector<HTMLElement>('.dou-image-preview')!
    const image = () => root.querySelector<HTMLElement>('.dou-image-preview__image')!
    const flipX = root.querySelector<HTMLButtonElement>('[aria-label="水平翻转"]')!
    flipX.click()
    await nextTick()
    expect(flipX.getAttribute('aria-pressed')).toBe('true')
    expect(image().style.transform).toContain('scale(-1, 1)')
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }))
    await nextTick()
    expect(image().style.transform).toContain('scale(-1, -1)')
    expect(root.querySelector('[aria-label="垂直翻转"]')!.getAttribute('aria-pressed')).toBe('true')
    // The flip comes before the turn, so it stays relative to the screen.
    expect(image().style.transform.indexOf('scale(-1, -1)')).toBeLessThan(
      image().style.transform.indexOf('rotate'),
    )
    expect(root.querySelector('[aria-label="下载"]')).toBeNull()
    wrapper.unmount()
  })

  it('downloads the current picture when downloadable', async () => {
    const fetch = vi.fn<(input: URL | RequestInfo) => Promise<Response>>(
      async () => new Response(new Blob(['x'])),
    )
    vi.stubGlobal('fetch', fetch)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = mount(DouImagePreview, {
      props: { open: true, images: ['/photos/%E6%B5%B7.png'], downloadable: true },
      attachTo: document.body,
    })
    await nextTick()
    document.querySelector<HTMLButtonElement>('[aria-label="下载"]')!.click()
    await vi.waitFor(() => expect(click).toHaveBeenCalled())
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toBe('海.png')
    expect(link.href.startsWith('blob:')).toBe(true)
    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('falls back to opening the picture when it cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<(input: URL | RequestInfo) => Promise<Response>>(async () =>
        Promise.reject(new TypeError('cors')),
      ),
    )
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await downloadImage('https://example.com/a/b.jpg')
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.href).toBe('https://example.com/a/b.jpg')
    expect(link.download).toBe('b.jpg')
    vi.unstubAllGlobals()
  })
})

describe('DouImage hydration', () => {
  it('picks up a picture that finished loading before it mounted', async () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    const width = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(960)
    const wrapper = mount(DouImage, { props: { src: 'a.png', alt: '海', preview: true } })
    await nextTick()
    expect(wrapper.get('.dou-image').classes()).toContain('is-loaded')
    expect(wrapper.get('.dou-image').attributes('role')).toBe('button')
    expect(wrapper.emitted('load')).toHaveLength(1)
    complete.mockRestore()
    width.mockRestore()
  })
})
