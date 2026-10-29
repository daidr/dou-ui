import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouCarousel, DouCarouselItem } from '../../../index'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

function make(props: Record<string, unknown> = {}, count = 4) {
  return mount(DouCarousel, {
    props,
    slots: {
      default: () =>
        Array.from({ length: count }, (_, i) => h(DouCarouselItem, () => `第 ${i + 1} 张`)),
    },
    attachTo: document.body,
  })
}

const items = (wrapper: ReturnType<typeof make>) => wrapper.findAll('.dou-carousel__item')
const shown = (wrapper: ReturnType<typeof make>) =>
  items(wrapper).findIndex((item) => item.classes().includes('is-active'))
const transform = (wrapper: ReturnType<typeof make>, index: number) =>
  (items(wrapper)[index]!.element as HTMLElement).style.transform

describe('DouCarousel', () => {
  it('lays slides out around the one shown, with carousel semantics', async () => {
    const wrapper = make()
    await nextTick()
    expect(wrapper.attributes('aria-roledescription')).toBe('carousel')
    expect(wrapper.attributes('aria-label')).toBe('轮播')
    expect(shown(wrapper)).toBe(0)
    const first = items(wrapper)[0]!
    expect(first.attributes('aria-roledescription')).toBe('slide')
    expect(first.attributes('aria-label')).toBe('第 1 张，共 4 张')
    expect(items(wrapper)[1]!.attributes('aria-hidden')).toBe('true')
    expect(transform(wrapper, 1)).toContain('100%')
    // looping: the last slide waits on the left
    expect(transform(wrapper, 3)).toContain('-100%')
  })

  it('moves with the arrows, indicators and keyboard, and wraps around', async () => {
    const wrapper = make()
    await nextTick()
    await wrapper.get('.dou-carousel__arrow--next').trigger('click')
    expect(shown(wrapper)).toBe(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[1]])
    expect(wrapper.emitted('change')).toEqual([[1, 0]])

    await wrapper.findAll('.dou-carousel__indicator')[3]!.trigger('click')
    expect(shown(wrapper)).toBe(3)
    expect(wrapper.findAll('.dou-carousel__indicator')[3]!.attributes('aria-current')).toBe('true')

    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    expect(shown(wrapper)).toBe(0)
    await wrapper.trigger('keydown', { key: 'ArrowLeft' })
    expect(shown(wrapper)).toBe(3)
  })

  it('jumps slides that wrap across the track without a transition', async () => {
    const wrapper = make({}, 5)
    await nextTick()
    await wrapper.get('.dou-carousel__arrow--next').trigger('click')
    // slide 0 went from 0 to -1: animated; slide 3 went from -2 (wrapped) to +2: jumps
    expect((items(wrapper)[0]!.element as HTMLElement).style.transitionDuration).toBe('')
    expect((items(wrapper)[3]!.element as HTMLElement).style.transitionDuration).toBe('0s')
  })

  it('stops at the ends without loop', async () => {
    const wrapper = make({ loop: false, modelValue: 0 })
    await nextTick()
    expect(wrapper.get('.dou-carousel__arrow--prev').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ modelValue: 3 })
    expect(wrapper.get('.dou-carousel__arrow--next').attributes('disabled')).toBeDefined()
    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('plays on its own and pauses on hover and with the pause button', async () => {
    vi.useFakeTimers()
    const wrapper = make({ autoplay: true, interval: 1000 })
    await nextTick()
    await nextTick()
    expect(wrapper.get('.dou-carousel__viewport').attributes('aria-live')).toBe('off')
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(shown(wrapper)).toBe(1)

    await wrapper.trigger('pointerenter')
    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(shown(wrapper)).toBe(1)
    await wrapper.trigger('pointerleave')

    const pause = wrapper.get('.dou-carousel__play')
    expect(pause.attributes('aria-label')).toBe('暂停自动播放')
    await pause.trigger('click')
    expect(pause.attributes('aria-label')).toBe('开始自动播放')
    expect(wrapper.get('.dou-carousel__viewport').attributes('aria-live')).toBe('polite')
    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(shown(wrapper)).toBe(1)
  })

  it('changes slides when dragged far enough', async () => {
    const wrapper = make()
    await nextTick()
    const viewport = wrapper.get('.dou-carousel__viewport')
    Object.defineProperty(viewport.element, 'clientWidth', { value: 400 })
    await viewport.trigger('pointerdown', { button: 0, pointerId: 1, clientX: 300 })
    await viewport.trigger('pointermove', { pointerId: 1, clientX: 250 })
    expect(transform(wrapper, 0)).toContain('-50px')
    expect(wrapper.classes()).toContain('is-dragging')
    await viewport.trigger('pointermove', { pointerId: 1, clientX: 150 })
    await viewport.trigger('pointerup', { pointerId: 1, clientX: 150 })
    expect(shown(wrapper)).toBe(1)
    expect(transform(wrapper, 0)).toContain('0px')
  })

  it('fades in place', async () => {
    const wrapper = make({ effect: 'fade', arrows: 'never', indicators: 'none' })
    await nextTick()
    expect(wrapper.classes()).toContain('dou-carousel--fade')
    expect(transform(wrapper, 1)).toBe('')
    expect(wrapper.find('.dou-carousel__arrow').exists()).toBe(false)
    expect(wrapper.find('.dou-carousel__indicator').exists()).toBe(false)
  })

  it('exposes goTo, next and prev', async () => {
    const wrapper = make()
    await nextTick()
    const api = wrapper.vm as unknown as { goTo: (i: number) => void; prev: () => void }
    api.goTo(2)
    await nextTick()
    expect(shown(wrapper)).toBe(2)
    api.prev()
    await nextTick()
    expect(shown(wrapper)).toBe(1)
  })
})
