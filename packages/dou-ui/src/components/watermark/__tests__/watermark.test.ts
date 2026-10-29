import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DouWatermark } from '../../../index'

const fillText = vi.fn()

beforeEach(() => {
  fillText.mockClear()
  // happy-dom has no canvas; stand in a 2d context that records text
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        font: '',
        fillStyle: '',
        textAlign: '',
        textBaseline: '',
        measureText: (text: string) => ({ width: text.length * 10 }),
        save() {},
        restore() {},
        scale() {},
        translate() {},
        rotate() {},
        drawImage() {},
        fillText,
      }) as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,x')
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise((resolve) => setTimeout(resolve))
  await nextTick()
}

describe('DouWatermark', () => {
  it('covers its content with a hidden, repeated mask', async () => {
    const wrapper = mount(DouWatermark, {
      props: { content: ['戴兜', '内部资料'], gap: [40, 20], staggered: false },
      slots: { default: () => '正文' },
    })
    await flush()
    const layer = wrapper.get('.dou-watermark__layer')
    expect(wrapper.text()).toBe('正文')
    expect(layer.attributes('aria-hidden')).toBe('true')
    const style = layer.element as HTMLElement
    expect(style.style.maskImage).toContain('data:image/png')
    // widest line (4 chars × 10px) + gap; two lines × 14px × 1.5 + gap
    expect(style.style.maskSize).toBe('80px 62px')
    expect(fillText.mock.calls.map(([text]) => text)).toContain('内部资料')
  })

  it('doubles the repeat height when staggered', async () => {
    const wrapper = mount(DouWatermark, { props: { content: 'abc', gap: [10, 10] } })
    await flush()
    expect((wrapper.get('.dou-watermark__layer').element as HTMLElement).style.maskSize).toBe(
      '40px 62px',
    )
  })

  it('applies color, opacity, z-index and fullscreen', async () => {
    const wrapper = mount(DouWatermark, {
      props: { content: 'x', color: 'red', opacity: 0.3, zIndex: 20, fullscreen: true },
    })
    await flush()
    const layer = wrapper.get('.dou-watermark__layer').element as HTMLElement
    expect(layer.style.getPropertyValue('--dou-watermark-color')).toBe('red')
    expect(layer.style.opacity).toBe('0.3')
    expect(layer.style.zIndex).toBe('20')
    expect(wrapper.classes()).toContain('is-fullscreen')
  })

  it('puts the layer back when it is removed or hidden', async () => {
    const wrapper = mount(DouWatermark, { props: { content: 'x' }, attachTo: document.body })
    await flush()
    const layer = wrapper.get('.dou-watermark__layer').element as HTMLElement
    layer.remove()
    await flush()
    expect(layer.parentNode).toBe(wrapper.element)

    layer.style.display = 'none'
    layer.classList.remove('dou-watermark__layer')
    await flush()
    expect(layer.style.display).toBe('')
    expect(layer.classList).toContain('dou-watermark__layer')

    // still updates normally afterwards
    await wrapper.setProps({ opacity: 0.5 })
    await flush()
    expect(layer.style.opacity).toBe('0.5')
  })

  it('leaves the layer alone when protection is off', async () => {
    const wrapper = mount(DouWatermark, {
      props: { content: 'x', protect: false },
      attachTo: document.body,
    })
    await flush()
    const layer = wrapper.get('.dou-watermark__layer').element as HTMLElement
    layer.style.display = 'none'
    await flush()
    expect(wrapper.get('.dou-watermark__layer').element).toBe(layer)
  })

  it('redraws when the content changes', async () => {
    const wrapper = mount(DouWatermark, { props: { content: 'a' }, attachTo: document.body })
    await flush()
    const before = wrapper.get('.dou-watermark__layer').element
    await wrapper.setProps({ content: 'bb' })
    await flush()
    expect(fillText.mock.calls.some(([text]) => text === 'bb')).toBe(true)
    // its own update is not mistaken for tampering
    expect(wrapper.get('.dou-watermark__layer').element).toBe(before)
  })
})
