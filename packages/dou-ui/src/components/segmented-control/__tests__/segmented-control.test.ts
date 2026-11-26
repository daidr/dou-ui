import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { DouForm, DouFormItem, DouSegmentedControl } from '../../../index'
import type { SegmentedControlProps, SegmentedControlValue } from '../../../index'

const options: SegmentedControlProps['options'] = [
  { value: 'list', label: '列表' },
  { value: 'board', label: '看板' },
  { value: 'calendar', label: '日历', disabled: true },
]

function setup(props: Partial<SegmentedControlProps> = {}) {
  const wrapper = mount(DouSegmentedControl, {
    props: {
      options,
      ...props,
      'onUpdate:modelValue': (value: SegmentedControlValue | undefined) =>
        wrapper.setProps({ modelValue: value }),
    },
  })
  return wrapper
}

describe('DouSegmentedControl', () => {
  it('renders a radio group with one native radio per option', () => {
    const wrapper = setup({ modelValue: 'list' })
    expect(wrapper.attributes('role')).toBe('radiogroup')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-segmented-control', 'dou-segmented-control--md']),
    )
    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(3)
    const names = new Set(radios.map((radio) => radio.attributes('name')))
    expect(names.size).toBe(1)
    expect((radios[0]!.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.findAll('.dou-segmented-control__label').map((l) => l.text())).toEqual([
      '列表',
      '看板',
      '日历',
    ])
  })

  it('accepts plain values as options', () => {
    const wrapper = setup({ options: ['日', '周', 12] })
    expect(wrapper.findAll('.dou-segmented-control__label').map((l) => l.text())).toEqual([
      '日',
      '周',
      '12',
    ])
  })

  it('selects an option and reports the change', async () => {
    const wrapper = setup({ modelValue: 'list' })
    await wrapper.findAll('input')[1]!.setValue(true)
    expect(wrapper.props('modelValue')).toBe('board')
    expect(wrapper.emitted('change')).toEqual([['board']])
    expect(wrapper.findAll('.dou-segmented-control__item')[1]!.classes()).toContain('is-checked')
  })

  it('disables single options or the whole control', () => {
    const wrapper = setup()
    expect(wrapper.findAll('input')[2]!.attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.dou-segmented-control__item')[2]!.classes()).toContain('is-disabled')
    const all = setup({ disabled: true })
    expect(all.findAll('input').every((input) => input.attributes('disabled') !== undefined)).toBe(
      true,
    )
    expect(all.attributes('aria-disabled')).toBe('true')
  })

  it('places the indicator on the selected option', async () => {
    const wrapper = setup({ modelValue: 'board' })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await nextTick()
    const indicator = wrapper.get('.dou-segmented-control__indicator')
    // happy-dom does no layout, so the block sits at 0 with no width,
    // but it is shown once there is a selection.
    expect(indicator.attributes('style')).not.toContain('display: none')
    await wrapper.setProps({ modelValue: 'missing' })
    await flushPromises()
    expect(indicator.attributes('style')).toContain('display: none')
  })

  it('stretches with block', () => {
    expect(setup({ block: true }).classes()).toContain('is-block')
  })

  it('takes its label and size from a form item', async () => {
    const wrapper = mount(DouForm, {
      props: { size: 'sm' },
      slots: {
        default: () =>
          h(DouFormItem, { label: '视图' }, () => h(DouSegmentedControl, { options: ['a', 'b'] })),
      },
    })
    await nextTick()
    const label = wrapper.get('label.dou-form-item__label')
    const group = wrapper.get('[role="radiogroup"]')
    expect(label.attributes('for')).toBeUndefined()
    expect(group.attributes('aria-labelledby')).toBe(label.attributes('id'))
    expect(group.classes()).toContain('dou-segmented-control--sm')
  })

  it('keeps plain option labels free of child elements so block ellipsis applies', () => {
    const wrapper = setup({
      modelValue: 'list',
      options: ['侧栏顶部（推荐）', '顶栏常驻按钮', '单项目右侧 [更多]'],
    })
    for (const label of wrapper.findAll('.dou-segmented-control__label')) {
      expect(label.element.children).toHaveLength(0)
    }
  })

  it('keeps pure-text #option slots flat and wraps bare text beside icons in __text', () => {
    const textOnly = mount(DouSegmentedControl, {
      props: { options: ['侧栏顶部（推荐）', '顶栏常驻按钮'], modelValue: '侧栏顶部（推荐）' },
      slots: {
        option: ({ option }: { option: { label?: string; value: SegmentedControlValue } }) =>
          `${option.label ?? option.value}（默认）`,
      },
    })
    for (const label of textOnly.findAll('.dou-segmented-control__label')) {
      expect(label.element.children).toHaveLength(0)
      expect(label.find('.dou-segmented-control__text').exists()).toBe(false)
    }

    const withIcon = mount({
      components: { DouSegmentedControl },
      data: () => ({
        showBadge: false,
        options: [
          { value: 'top', label: '侧栏顶部（推荐）' },
          { value: 'bar', label: '顶栏常驻按钮' },
        ],
      }),
      template: `
        <DouSegmentedControl :options="options" model-value="top">
          <template #option="{ option }">
            <svg class="mock-icon" aria-hidden="true" />
            {{ option.label }}
            <span v-if="showBadge" class="mock-badge">新</span>
          </template>
        </DouSegmentedControl>
      `,
    })
    const firstLabel = withIcon.findAll('.dou-segmented-control__label')[0]!
    expect(firstLabel.find('svg.mock-icon').exists()).toBe(true)
    const texts = firstLabel.findAll('.dou-segmented-control__text')
    expect(texts).toHaveLength(1)
    expect(texts[0]!.text()).toBe('侧栏顶部（推荐）')

    const iconOnly = mount(DouSegmentedControl, {
      props: { options: ['list', 'board'], modelValue: 'list' },
      slots: {
        option: () => h('svg', { class: 'mock-icon' }),
      },
    })
    expect(iconOnly.find('.dou-segmented-control__text').exists()).toBe(false)
    expect(iconOnly.findAll('svg.mock-icon')).toHaveLength(2)
  })

  it('updates rendered labels when the parent swaps the #option slot with unchanged options and value', async () => {
    const staticOptions: SegmentedControlProps['options'] = [
      { value: 'list', label: '列表' },
      { value: 'board', label: '看板' },
    ]
    const compact = ref(false)
    const Host = defineComponent({
      setup() {
        return () =>
          h(
            DouSegmentedControl,
            { options: staticOptions, modelValue: 'list' },
            {
              option: compact.value
                ? ({ option }: { option: { label?: string; value: SegmentedControlValue } }) => [
                    h('svg', { class: 'compact-icon' }),
                    `${option.label ?? option.value}`,
                  ]
                : ({ option }: { option: { label?: string; value: SegmentedControlValue } }) =>
                    `完整·${option.label ?? option.value}`,
            },
          )
      },
    })

    const wrapper = mount(Host)
    expect(wrapper.findAll('.dou-segmented-control__label').map((l) => l.text())).toEqual([
      '完整·列表',
      '完整·看板',
    ])
    expect(wrapper.find('.compact-icon').exists()).toBe(false)

    compact.value = true
    await nextTick()
    expect(wrapper.findAll('.compact-icon')).toHaveLength(2)
    expect(wrapper.findAll('.dou-segmented-control__text').map((t) => t.text())).toEqual([
      '列表',
      '看板',
    ])

    compact.value = false
    await nextTick()
    expect(wrapper.find('.compact-icon').exists()).toBe(false)
    expect(wrapper.findAll('.dou-segmented-control__label').map((l) => l.text())).toEqual([
      '完整·列表',
      '完整·看板',
    ])

    const templateHost = mount({
      components: { DouSegmentedControl },
      data: () => ({
        compact: false,
        options: staticOptions,
      }),
      template: `
        <DouSegmentedControl :options="options" model-value="list">
          <template v-if="compact" #option="{ option }">短·{{ option.label }}</template>
          <template v-else #option="{ option }">长·{{ option.label }}</template>
        </DouSegmentedControl>
      `,
    })
    expect(templateHost.findAll('.dou-segmented-control__label').map((l) => l.text())).toEqual([
      '长·列表',
      '长·看板',
    ])
    await templateHost.setData({ compact: true })
    expect(templateHost.findAll('.dou-segmented-control__label').map((l) => l.text())).toEqual([
      '短·列表',
      '短·看板',
    ])
  })

  it('falls back to the default label when #option renders nothing, while preserving numeric 0', () => {
    const conditional = mount({
      components: { DouSegmentedControl },
      data: () => ({
        options: [
          { value: 'list', label: '列表' },
          { value: 'board', label: '看板' },
        ],
      }),
      template: `
        <DouSegmentedControl :options="options" model-value="list">
          <template #option="{ option }">
            <span v-if="option.value === 'list'" class="custom-only">定制列表</span>
          </template>
        </DouSegmentedControl>
      `,
    })
    const labels = conditional.findAll('.dou-segmented-control__label')
    expect(labels[0]!.find('.custom-only').text()).toBe('定制列表')
    expect(labels[1]!.text()).toBe('看板')
    expect(labels[1]!.element.children).toHaveLength(0)

    const zeroSlot = mount(DouSegmentedControl, {
      props: {
        options: [
          { value: 0, label: '零' },
          { value: 1, label: '一' },
        ],
        modelValue: 0,
      },
      slots: {
        option: ({ option }: { option: { value: SegmentedControlValue } }) => option.value,
      },
    })
    expect(zeroSlot.findAll('.dou-segmented-control__label').map((l) => l.text())).toEqual([
      '0',
      '1',
    ])
    for (const label of zeroSlot.findAll('.dou-segmented-control__label')) {
      expect(label.element.children).toHaveLength(0)
    }
  })

  it('remeasures the indicator on block/options changes and observes only root and option items', async () => {
    let widths = [60, 100, 80]
    const observed: Element[][] = []
    let disconnects = 0

    class MockResizeObserver {
      private current: Element[] = []
      observe(target: Element) {
        this.current.push(target)
      }
      unobserve() {}
      disconnect() {
        if (this.current.length) observed.push([...this.current])
        this.current = []
        disconnects++
      }
      // expose snapshot of active targets for assertions
      static instances: MockResizeObserver[] = []
      constructor() {
        MockResizeObserver.instances.push(this)
      }
      activeTargets() {
        return [...this.current]
      }
    }

    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    const realGetComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      const style = realGetComputedStyle(el)
      if (el.classList.contains('dou-segmented-control')) {
        return new Proxy(style, {
          get(target, prop, receiver) {
            if (prop === 'paddingLeft') return '2px'
            return Reflect.get(target, prop, receiver)
          },
        })
      }
      if (el.classList.contains('dou-segmented-control__item')) {
        const items = [
          ...(el.parentElement?.querySelectorAll('.dou-segmented-control__item') ?? []),
        ]
        const idx = items.indexOf(el)
        const w = widths[idx] ?? 0
        return new Proxy(style, {
          get(target, prop, receiver) {
            if (prop === 'width') return `${w}px`
            if (prop === 'boxSizing') return 'border-box'
            return Reflect.get(target, prop, receiver)
          },
        })
      }
      return style
    })

    try {
      const wrapper = setup({ modelValue: 'board' })
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await nextTick()

      const observer = MockResizeObserver.instances[0]!
      const initialTargets = observer.activeTargets()
      const rootEl = wrapper.element
      const indicatorEl = wrapper.get('.dou-segmented-control__indicator').element
      const initialItems = wrapper.findAll('.dou-segmented-control__item').map((w) => w.element)
      expect(initialTargets).toContain(rootEl)
      expect(initialTargets).toEqual(expect.arrayContaining(initialItems))
      expect(initialTargets).not.toContain(indicatorEl)

      const indicator = wrapper.get('.dou-segmented-control__indicator')
      expect(indicator.attributes('style')).toContain('translateX(62px)')
      expect(indicator.attributes('style')).toContain('width: 100px')

      // Switching `block` updates widths and triggers remeasure without changing model/options.
      widths = [94, 94, 94]
      await wrapper.setProps({ block: true })
      await flushPromises()
      expect(indicator.attributes('style')).toContain('translateX(96px)')
      expect(indicator.attributes('style')).toContain('width: 94px')

      // Selecting a not-yet-present option hides indicator, then adding it to options re-observes & measures it.
      await wrapper.setProps({ modelValue: 'timeline' })
      await flushPromises()
      expect(indicator.attributes('style')).toContain('display: none')

      const disconnectsBefore = disconnects
      widths = [50, 70, 80, 90]
      await wrapper.setProps({
        options: [
          { value: 'list', label: '列表' },
          { value: 'board', label: '看板' },
          { value: 'calendar', label: '日历' },
          { value: 'timeline', label: '时间线视图' },
        ],
      })
      await flushPromises()

      expect(disconnects).toBeGreaterThan(disconnectsBefore)
      const updatedItems = wrapper.findAll('.dou-segmented-control__item').map((w) => w.element)
      expect(updatedItems).toHaveLength(4)
      const updatedTargets = observer.activeTargets()
      expect(updatedTargets).toContain(rootEl)
      expect(updatedTargets).toEqual(expect.arrayContaining(updatedItems))
      expect(updatedTargets).not.toContain(indicatorEl)
      expect(indicator.attributes('style')).toContain('translateX(202px)')
      expect(indicator.attributes('style')).toContain('width: 90px')
      expect(observed.length).toBeGreaterThan(0)
    } finally {
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    }
  })
})
