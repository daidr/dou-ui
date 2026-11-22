import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, onUnmounted, ref } from 'vue'
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

// every element measures `width` wide; `resize` tells the last observer
let width = 0
let observed: ResizeObserverCallback | undefined
class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    observed = callback
  }
  observe() {}
  disconnect() {}
}
function measure(next: number) {
  width = next
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ left: 0, top: 0, width, height: 300 }) as DOMRect,
  )
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
}
function resize(next: number) {
  width = next
  observed?.(
    [
      {
        borderBoxSize: [{ inlineSize: next, blockSize: 300 }],
        contentRect: { width: next, height: 300 },
      } as unknown as ResizeObserverEntry,
    ],
    {} as ResizeObserver,
  )
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
      // the panes share 999px beside the 1px divider: 24.03% of it is 240.06px, never under 240
      expect(wrapper.attributes('style')).toContain('minmax(0, 75.97fr) auto minmax(0, 24.03fr)')
      expect((24.03 / 100) * 999).toBeGreaterThanOrEqual(240)
      // shown within the limit, the model untouched until the divider moves
      expect(wrapper.props('modelValue')).toBe(90)
      await bar.trigger('keydown', { key: 'End' })
      expect(wrapper.props('modelValue')).toBe(75.97)
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

    it('keeps the bottom pane at least `minEnd` when vertical', async () => {
      measure(1000)
      const wrapper = make({ direction: 'vertical', modelValue: 90, minEnd: '120px' })
      await wrapper.vm.$nextTick()
      // 300px tall, 299 for the panes: 40.14% of it is 120.02px
      expect(wrapper.attributes('style')).toContain(
        'grid-template-rows: minmax(0, 59.86fr) auto minmax(0, 40.14fr)',
      )
      expect((40.14 / 100) * 299).toBeGreaterThanOrEqual(120)
    })

    it('makes room for the px limits of a splitter inside a pane', async () => {
      measure(1000)
      const wrapper = mount(
        {
          components: { DouSplitter },
          template: `
            <DouSplitter :model-value="80" min="240px" min-end="240px">
              <template #start><p>左</p></template>
              <template #end>
                <DouSplitter min="240px" min-end="240px">
                  <template #start><p>中</p></template>
                  <template #end><p>右</p></template>
                </DouSplitter>
              </template>
            </DouSplitter>`,
        },
        { attachTo: document.body },
      )
      await wrapper.vm.$nextTick()
      // the inner one needs 240 + 1 + 240 px of the outer 999, so the outer first pane stops at 51.85%
      const bar = wrapper.get('[role="separator"]')
      expect(bar.attributes('aria-valuemax')).toBe('52')
      expect(wrapper.get('.dou-splitter').attributes('style')).toContain('minmax(0, 51.85fr)')
      wrapper.unmount()
    })

    it('keeps fixed pixel size in `unit="px"` mode and accounts for the divider on resize', async () => {
      measure(1000)
      const wrapper = make({ unit: 'px', modelValue: 220, min: 160, max: 360, minEnd: 240 })
      await wrapper.vm.$nextTick()
      const bar = wrapper.get('[role="separator"]')
      expect(wrapper.attributes('style')).toContain(
        'grid-template-columns: 220px auto minmax(0, 1fr)',
      )
      expect(bar.attributes('aria-valuemin')).toBe('160')
      expect(bar.attributes('aria-valuemax')).toBe('360')
      expect(bar.attributes('aria-valuenow')).toBe('220')

      // Container shrinks, still room for 220 + 1 + 240: stays at 220px
      resize(700)
      await wrapper.vm.$nextTick()
      expect(wrapper.attributes('style')).toContain(
        'grid-template-columns: 220px auto minmax(0, 1fr)',
      )

      // Container shrinks to 420px (419px without 1px divider): max start is 419 - 240 = 179px
      resize(420)
      await wrapper.vm.$nextTick()
      expect(wrapper.attributes('style')).toContain(
        'grid-template-columns: 179px auto minmax(0, 1fr)',
      )
      expect(bar.attributes('aria-valuemax')).toBe('179')
      expect(wrapper.props('modelValue')).toBe(220)

      // Container shrinks below min + minEnd (160 + 240 = 400): proportional share of 299px
      resize(300)
      await wrapper.vm.$nextTick()
      expect(wrapper.attributes('style')).toContain(
        'grid-template-columns: 119.6px auto minmax(0, 1fr)',
      )

      // Container widens again: restores persisted 220px without mutating modelValue
      resize(900)
      await wrapper.vm.$nextTick()
      expect(wrapper.attributes('style')).toContain(
        'grid-template-columns: 220px auto minmax(0, 1fr)',
      )
      expect(wrapper.props('modelValue')).toBe(220)
    })

    it('drags and navigates with keyboard in `unit="px"` mode', async () => {
      measure(1000)
      const wrapper = make({ unit: 'px', modelValue: 220, min: 160, max: 360 })
      await wrapper.vm.$nextTick()
      const bar = wrapper.get('[role="separator"]')

      // Default step in px mode is 10px, Shift is 100px
      await bar.trigger('keydown', { key: 'ArrowRight' })
      expect(wrapper.props('modelValue')).toBe(230)
      await bar.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
      expect(wrapper.props('modelValue')).toBe(330)
      await bar.trigger('keydown', { key: 'End' })
      expect(wrapper.props('modelValue')).toBe(360)
      await bar.trigger('keydown', { key: 'Home' })
      expect(wrapper.props('modelValue')).toBe(160)

      // Drag to x = 280.5 -> 280px after deducting BAR / 2
      await bar.trigger('pointerdown', { button: 0, pointerId: 1 })
      await bar.trigger('pointermove', { clientX: 280.5 })
      expect(wrapper.props('modelValue')).toBe(280)
      await bar.trigger('pointerup')
      expect(wrapper.emitted('change')!.at(-1)).toEqual([280])
    })

    it('does not cap max at 100 when `max` is omitted in `unit="px"` mode', async () => {
      measure(1000)
      const wrapper = make({ unit: 'px', modelValue: 260, min: 160, minEnd: 240 })
      await wrapper.vm.$nextTick()
      const bar = wrapper.get('[role="separator"]')
      expect(wrapper.attributes('style')).toContain(
        'grid-template-columns: 260px auto minmax(0, 1fr)',
      )
      // 999 - 240 = 759px
      expect(bar.attributes('aria-valuemax')).toBe('759')
      await bar.trigger('keydown', { key: 'End' })
      expect(wrapper.props('modelValue')).toBe(759)
    })

    it('supports string px limits and vertical direction in `unit="px"` mode', async () => {
      measure(1000)
      const wrapper = make({
        direction: 'vertical',
        unit: 'px',
        modelValue: 220,
        min: '80px',
        max: '260px',
        minEnd: '120px',
      })
      await wrapper.vm.$nextTick()
      // 300px tall, 299px for panes: 299 - 120 = 179px max start
      expect(wrapper.attributes('style')).toContain('grid-template-rows: 179px auto minmax(0, 1fr)')
      const bar = wrapper.get('[role="separator"]')
      await bar.trigger('pointerdown', { button: 0, pointerId: 1 })
      await bar.trigger('pointermove', { clientY: 100.5 })
      expect(wrapper.props('modelValue')).toBe(100)
      await bar.trigger('pointerup')
      expect(wrapper.emitted('change')!.at(-1)).toEqual([100])
    })

    it('collapses cleanly and reports nested px limits in `unit="px"` mode', async () => {
      measure(1000)
      const wrapper = mount(
        {
          components: { DouSplitter },
          template: `
            <DouSplitter unit="px" :model-value="700" :min="160" :min-end="100">
              <template #start><p>左</p></template>
              <template #end>
                <DouSplitter unit="px" :model-value="240" :min="200" :min-end="240">
                  <template #start><p>中</p></template>
                  <template #end><p>右</p></template>
                </DouSplitter>
              </template>
            </DouSplitter>`,
        },
        { attachTo: document.body },
      )
      await wrapper.vm.$nextTick()
      // Inner splitter needs 200 + 1 + 240 = 441px, so outer start stops at 999 - 441 = 558px
      const outer = wrapper.get('.dou-splitter')
      expect(outer.attributes('style')).toContain(
        'grid-template-columns: 558px auto minmax(0, 1fr)',
      )
      wrapper.unmount()
    })

    it('reports only the active pane min size when a nested splitter is in single-pane mode', async () => {
      measure(1000)
      const singlePane = ref<'start' | 'end' | null>(null)
      const wrapper = mount(
        {
          components: { DouSplitter },
          setup: () => ({ singlePane }),
          template: `
            <DouSplitter unit="px" :model-value="700" :min="160">
              <template #start><p>左</p></template>
              <template #end>
                <DouSplitter unit="px" :min="200" :min-end="300" :single-pane="singlePane">
                  <template #start><p>中</p></template>
                  <template #end><p>右</p></template>
                </DouSplitter>
              </template>
            </DouSplitter>`,
        },
        { attachTo: document.body },
      )
      await wrapper.vm.$nextTick()
      const outer = wrapper.get('.dou-splitter')
      // Both inner panes visible: needs 200 + 1 + 300 = 501px -> outer max = 999 - 501 = 498px
      expect(outer.attributes('style')).toContain(
        'grid-template-columns: 498px auto minmax(0, 1fr)',
      )

      singlePane.value = 'start'
      await wrapper.vm.$nextTick()
      // Only inner start pane visible: needs 200px -> outer max = 999 - 200 = 799px, so 700px fits
      expect(outer.attributes('style')).toContain(
        'grid-template-columns: 700px auto minmax(0, 1fr)',
      )

      singlePane.value = 'end'
      await wrapper.vm.$nextTick()
      // Only inner end pane visible: needs 300px -> outer max = 999 - 300 = 699px
      expect(outer.attributes('style')).toContain(
        'grid-template-columns: 699px auto minmax(0, 1fr)',
      )
      wrapper.unmount()
    })
  })

  describe('single-pane mode', () => {
    it('shows only the active pane at full size while keeping both panes mounted', async () => {
      const startUnmounted = vi.fn<() => void>()
      const endUnmounted = vi.fn<() => void>()
      const DraftPane = defineComponent({
        props: { label: { type: String, required: true }, onLeave: { type: Function } },
        setup(props) {
          const draft = ref(`${props.label}-draft`)
          onUnmounted(() => props.onLeave?.())
          return { draft }
        },
        template: '<input v-model="draft" :data-pane="label" />',
      })

      const singlePane = ref<'start' | 'end' | null>(null)
      const size = ref(35)
      const wrapper = mount({
        components: { DouSplitter, DraftPane },
        setup: () => ({ singlePane, size, startUnmounted, endUnmounted }),
        template: `
          <DouSplitter v-model="size" :single-pane="singlePane">
            <template #start><DraftPane label="start" :on-leave="startUnmounted" /></template>
            <template #end><DraftPane label="end" :on-leave="endUnmounted" /></template>
          </DouSplitter>`,
      })

      const root = wrapper.get('.dou-splitter')
      const startPane = wrapper.get('.dou-splitter__pane.is-start')
      const endPane = wrapper.get('.dou-splitter__pane.is-end')
      const bar = wrapper.get('[role="separator"]')

      // Mutate inputs in both panes before switching
      await wrapper.get('input[data-pane="start"]').setValue('unsaved chat')
      await wrapper.get('input[data-pane="end"]').setValue('editor buffer')

      // Switch to start-only single pane
      singlePane.value = 'start'
      await wrapper.vm.$nextTick()
      expect(root.classes()).toContain('is-single-pane')
      expect(root.classes()).toContain('is-single-start')
      expect(root.classes()).not.toContain('is-single-end')
      expect(root.attributes('style')).toContain('grid-template-columns: minmax(0, 1fr)')
      expect(bar.attributes('hidden')).toBeDefined()
      expect(bar.attributes('tabindex')).toBeUndefined()
      expect(startPane.attributes('hidden')).toBeUndefined()
      expect(endPane.attributes('hidden')).toBeDefined()

      // Switch to end-only single pane
      singlePane.value = 'end'
      await wrapper.vm.$nextTick()
      expect(root.classes()).toContain('is-single-pane')
      expect(root.classes()).toContain('is-single-end')
      expect(root.classes()).not.toContain('is-single-start')
      expect(startPane.attributes('hidden')).toBeDefined()
      expect(endPane.attributes('hidden')).toBeUndefined()
      expect(bar.attributes('hidden')).toBeDefined()

      // Switch back to dual-pane mode
      singlePane.value = null
      await wrapper.vm.$nextTick()
      expect(root.classes()).not.toContain('is-single-pane')
      expect(root.attributes('style')).toContain(
        'grid-template-columns: minmax(0, 35fr) auto minmax(0, 65fr)',
      )
      expect(bar.attributes('hidden')).toBeUndefined()
      expect(bar.attributes('tabindex')).toBe('0')
      expect(startPane.attributes('hidden')).toBeUndefined()
      expect(endPane.attributes('hidden')).toBeUndefined()

      // Both panes stayed mounted and preserved their state and modelValue
      expect(startUnmounted).not.toHaveBeenCalled()
      expect(endUnmounted).not.toHaveBeenCalled()
      expect((wrapper.get('input[data-pane="start"]').element as HTMLInputElement).value).toBe(
        'unsaved chat',
      )
      expect((wrapper.get('input[data-pane="end"]').element as HTMLInputElement).value).toBe(
        'editor buffer',
      )
      expect(size.value).toBe(35)
    })

    it('does not hide the active start pane when collapsed is true and restores collapsed later', async () => {
      const wrapper = make({ collapsible: true, collapsed: true, singlePane: 'start' })
      expect(wrapper.classes()).not.toContain('is-collapsed')
      expect(wrapper.classes()).toContain('is-single-start')
      expect(wrapper.get('.dou-splitter__pane.is-start').attributes('hidden')).toBeUndefined()

      await wrapper.setProps({ singlePane: null })
      expect(wrapper.classes()).toContain('is-collapsed')
      expect(wrapper.props('collapsed')).toBe(true)
    })

    it('cancels dragging and ignores keyboard or dblclick while in single-pane mode', async () => {
      const wrapper = make({ collapsible: true })
      const bar = wrapper.get('[role="separator"]')
      await bar.trigger('pointerdown', { button: 0, pointerId: 1 })
      expect(wrapper.classes()).toContain('is-dragging')

      await wrapper.setProps({ singlePane: 'end' })
      expect(wrapper.classes()).not.toContain('is-dragging')

      await bar.trigger('keydown', { key: 'ArrowRight' })
      await bar.trigger('dblclick')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.emitted('update:collapsed')).toBeUndefined()
    })

    it('uses single-track grid-template-rows when vertical', () => {
      const wrapper = make({ direction: 'vertical', singlePane: 'end' })
      expect(wrapper.attributes('style')).toContain('grid-template-rows: minmax(0, 1fr)')
    })
  })

  it('collapses in px mode without losing the pixel modelValue', async () => {
    const wrapper = make({ unit: 'px', modelValue: 220, min: 160, max: 360, collapsible: true })
    const bar = wrapper.get('[role="separator"]')
    await bar.trigger('dblclick')
    expect(wrapper.props('collapsed')).toBe(true)
    expect(wrapper.attributes('style')).toContain('grid-template-columns: 0px auto minmax(0, 1fr)')
    expect(bar.attributes('aria-valuenow')).toBe('0')
    await bar.trigger('dblclick')
    expect(wrapper.props('collapsed')).toBe(false)
    expect(wrapper.attributes('style')).toContain(
      'grid-template-columns: 220px auto minmax(0, 1fr)',
    )
  })

  it('warns about a string limit that is not px', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    make({ min: '20%' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`min` is "20%"'))
    warn.mockRestore()
  })
})
