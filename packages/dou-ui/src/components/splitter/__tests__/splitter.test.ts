import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouSplitter } from '../../../index'

const make = (props: Record<string, unknown> = {}) => {
  const wrapper = mount(DouSplitter, {
    props: {
      modelValue: 50,
      'onUpdate:modelValue': (v: number) => wrapper.setProps({ modelValue: v }),
      'onUpdate:collapsed': (v: boolean) => wrapper.setProps({ collapsed: v }),
      ...props,
    },
    slots: { start: '<p>左</p>', end: '<p>右</p>' },
  })
  return wrapper
}

describe('DouSplitter', () => {
  it('lays out two panes with a separator between', () => {
    const wrapper = make({ modelValue: 30 })
    expect(wrapper.attributes('style')).toContain(
      'grid-template-columns: minmax(0, 30fr) auto minmax(0, 70fr)',
    )
    const bar = wrapper.get('[role="separator"]')
    expect(bar.attributes('aria-orientation')).toBe('vertical')
    expect(bar.attributes('aria-valuenow')).toBe('30')
    expect(bar.attributes('aria-label')).toBe('调整面板大小')
    expect(bar.attributes('aria-controls')).toBe(
      wrapper.find('.dou-splitter__pane.is-start').attributes('id'),
    )
  })

  it('stacks the panes when vertical', () => {
    const wrapper = make({ direction: 'vertical' })
    expect(wrapper.attributes('style')).toContain('grid-template-rows')
    expect(wrapper.get('[role="separator"]').attributes('aria-orientation')).toBe('horizontal')
  })

  it('moves with the keyboard within its limits', async () => {
    const wrapper = make({ min: 20, max: 60 })
    const bar = wrapper.get('[role="separator"]')
    await bar.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.props('modelValue')).toBe(51)
    await bar.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    expect(wrapper.props('modelValue')).toBe(60)
    await bar.trigger('keydown', { key: 'Home' })
    expect(wrapper.props('modelValue')).toBe(20)
    await bar.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.props('modelValue')).toBe(20)
    expect(wrapper.emitted('change')!.at(-1)).toEqual([20])
  })

  it('folds the first pane away and back', async () => {
    const wrapper = make({ collapsible: true })
    const bar = wrapper.get('[role="separator"]')
    await bar.trigger('keydown', { key: 'Enter' })
    expect(wrapper.props('collapsed')).toBe(true)
    expect(wrapper.classes()).toContain('is-collapsed')
    expect(bar.attributes('aria-valuenow')).toBe('0')
    await bar.trigger('dblclick')
    expect(wrapper.props('collapsed')).toBe(false)
    expect(bar.attributes('aria-valuenow')).toBe('50')
  })

  it('does nothing while disabled', async () => {
    const wrapper = make({ disabled: true, collapsible: true })
    const bar = wrapper.get('[role="separator"]')
    expect(bar.attributes('tabindex')).toBeUndefined()
    await bar.trigger('keydown', { key: 'ArrowRight' })
    await bar.trigger('dblclick')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('update:collapsed')).toBeUndefined()
  })

  describe('with a measured width', () => {
    let resize: (width: number) => void = () => {}
    const measure = (width: number) => {
      let current = width
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
        () => ({ width: current, height: 300 }) as DOMRect,
      )
      let callback: ResizeObserverCallback | undefined
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: ResizeObserverCallback) {
            callback = cb
          }
          observe() {}
          disconnect() {}
        },
      )
      resize = (next) => {
        current = next
        callback?.(
          [
            {
              borderBoxSize: [{ inlineSize: next, blockSize: 300 }],
              contentRect: { width: next, height: 300 },
            } as unknown as ResizeObserverEntry,
          ],
          {} as ResizeObserver,
        )
      }
    }
    afterEach(() => {
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    })

    it('keeps the second pane at least `minEnd`', async () => {
      measure(1000)
      const wrapper = make({ modelValue: 90, minEnd: '240px' })
      await wrapper.vm.$nextTick()
      const bar = wrapper.get('[role="separator"]')
      expect(bar.attributes('aria-valuemax')).toBe('76')
      expect(bar.attributes('aria-valuenow')).toBe('76')
      expect(wrapper.attributes('style')).toContain('minmax(0, 76fr) auto minmax(0, 24fr)')
      // shown within the limit, the model untouched until the divider moves
      expect(wrapper.props('modelValue')).toBe(90)
      await bar.trigger('keydown', { key: 'End' })
      expect(wrapper.props('modelValue')).toBe(76)
    })

    it('holds px limits as the container resizes', async () => {
      measure(1000)
      const wrapper = make({ modelValue: 50, min: '240px', minEnd: '240px' })
      await wrapper.vm.$nextTick()
      expect(wrapper.attributes('style')).toContain('minmax(0, 50fr)')
      resize(400)
      await wrapper.vm.$nextTick()
      // 400px is less than 240 + 240: the panes share it in proportion
      expect(wrapper.attributes('style')).toContain('minmax(0, 50fr) auto minmax(0, 50fr)')
      resize(600)
      await wrapper.vm.$nextTick()
      const bar = wrapper.get('[role="separator"]')
      expect(bar.attributes('aria-valuemin')).toBe('40')
      expect(bar.attributes('aria-valuemax')).toBe('60')
    })

    it('shares a container too small for both minimums in proportion', async () => {
      measure(400)
      const wrapper = make({ modelValue: 20, min: '300px', minEnd: '100px' })
      await wrapper.vm.$nextTick()
      // just fits: the first pane at its minimum
      expect(wrapper.attributes('style')).toContain('minmax(0, 75fr) auto minmax(0, 25fr)')
      await wrapper.setProps({ modelValue: 20, min: '300px', minEnd: '200px' })
      await wrapper.vm.$nextTick()
      expect(wrapper.attributes('style')).toContain('minmax(0, 60fr) auto minmax(0, 40fr)')
    })
  })
})
