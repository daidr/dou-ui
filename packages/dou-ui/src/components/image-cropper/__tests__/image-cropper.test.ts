import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouImageCropper } from '../../../index'

afterEach(() => vi.restoreAllMocks())

/** A 400 × 300 stage and an 800 × 400 image that has loaded. */
async function mountLoaded(props: Record<string, unknown> = {}) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)
  const wrapper = mount(DouImageCropper, {
    props: { src: 'photo.jpg', ...props },
    attachTo: document.body,
  })
  await nextTick()
  const img = wrapper.get('img').element
  Object.defineProperty(img, 'naturalWidth', { value: 800 })
  Object.defineProperty(img, 'naturalHeight', { value: 400 })
  img.dispatchEvent(new Event('load'))
  await nextTick()
  return wrapper
}

describe('DouImageCropper', () => {
  it('fits the frame in the stage and covers it with the image', async () => {
    const wrapper = await mountLoaded()
    expect(wrapper.emitted('ready')).toEqual([[{ width: 800, height: 400 }]])
    // 300 - 2 × 24 = 252: the square frame, filled by the image's 400px height.
    const frame = wrapper.get('.dou-image-cropper__frame')
    expect(frame.attributes('style')).toContain('width: 252px')
    expect(wrapper.vm.getArea()).toEqual({ x: 200, y: 0, width: 400, height: 400, rotate: 0 })
    expect(wrapper.emitted('change')![0]).toEqual([
      { x: 200, y: 0, width: 400, height: 400, rotate: 0 },
    ])
  })

  it('moves with the arrow keys, zooms with plus and minus, stays inside the image', async () => {
    const wrapper = await mountLoaded()
    const stage = wrapper.get('.dou-image-cropper__stage')
    expect(stage.attributes('tabindex')).toBe('0')
    expect(stage.attributes('aria-label')).toBe('图片裁剪')

    // The image moves left, so the frame sees more of its right side.
    await stage.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(wrapper.vm.getArea()!.x).toBeGreaterThan(200)
    // It cannot move up: at the smallest zoom the height fits exactly.
    await stage.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.vm.getArea()!.y).toBe(0)

    await stage.trigger('keydown', { key: '+' })
    expect(wrapper.vm.getArea()!.width).toBeLessThan(400)
    wrapper.vm.reset()
    expect(wrapper.vm.getArea()).toEqual({ x: 200, y: 0, width: 400, height: 400, rotate: 0 })
  })

  it('rotates by quarter turns and frames a wide crop', async () => {
    const wrapper = await mountLoaded({ aspectRatio: 2 })
    expect(wrapper.vm.getArea()).toEqual({ x: 0, y: 0, width: 800, height: 400, rotate: 0 })
    await wrapper.findAll('.dou-image-cropper__toolbar .dou-button')[3]!.trigger('click')
    const area = wrapper.vm.getArea()!
    expect(area.rotate).toBe(90)
    // Turned upright the image is 400 wide, so a 2:1 frame takes its full width.
    expect(area.width).toBe(400)
    expect(area.height).toBe(200)
  })

  it('shows a spinner while loading and a message when the image fails', async () => {
    const wrapper = mount(DouImageCropper, { props: { src: 'missing.jpg', toolbar: false } })
    await nextTick()
    expect(wrapper.find('.dou-spinner').exists()).toBe(true)
    expect(wrapper.find('.dou-image-cropper__toolbar').exists()).toBe(false)
    wrapper.get('img').element.dispatchEvent(new Event('error'))
    await nextTick()
    expect(wrapper.get('[role="alert"]').text()).toBe('图片加载失败')
    expect(wrapper.emitted('error')).toHaveLength(1)
  })
})
