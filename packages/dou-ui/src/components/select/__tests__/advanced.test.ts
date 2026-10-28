import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouSelect } from '../../../index'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

const optionEls = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')]
const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))

function withModel(props: Record<string, unknown>) {
  const wrapper = mount(DouSelect, {
    props: {
      modelValue: null,
      'onUpdate:modelValue': (value: unknown) => wrapper.setProps({ modelValue: value as never }),
      ...props,
    } as never,
    attachTo: document.body,
  })
  return wrapper
}

const open = async (wrapper: ReturnType<typeof withModel>) => {
  await wrapper.get('.dou-select').trigger('mousedown')
  await nextTick()
}

describe('DouSelect groups', () => {
  const grouped = [
    { label: '亚洲', options: [{ value: 'sh', label: '上海' }, 'sg'] },
    { label: '欧洲', disabled: true, options: [{ value: 'fra', label: '法兰克福' }] },
  ]

  it('lists options under labelled groups', async () => {
    const wrapper = withModel({ options: grouped })
    await open(wrapper)
    const groups = [...document.querySelectorAll('[role="group"]')]
    expect(groups).toHaveLength(2)
    expect(
      document.getElementById(groups[0]!.getAttribute('aria-labelledby')!)?.textContent,
    ).toContain('亚洲')
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual(['上海', 'sg', '法兰克福'])
    expect(optionEls()[2]!.getAttribute('aria-disabled')).toBe('true')
  })

  it('moves across groups with the keyboard and skips disabled groups', async () => {
    const wrapper = withModel({ options: grouped })
    const box = wrapper.get('[role="combobox"]').element
    key(box, 'ArrowDown')
    await nextTick()
    key(box, 'ArrowDown')
    key(box, 'ArrowDown')
    await nextTick()
    expect(box.getAttribute('aria-activedescendant')).toBe(optionEls()[0]!.id)
    key(box, 'Enter')
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('sh')
  })

  it('filters inside groups and drops empty groups', async () => {
    const wrapper = withModel({ options: grouped, filterable: true })
    await wrapper.get('input').setValue('上')
    expect(document.querySelectorAll('[role="group"]')).toHaveLength(1)
    expect(optionEls().map((el) => el.textContent?.trim())).toEqual(['上海'])
  })
})

describe('DouSelect remote', () => {
  it('emits search after a pause, shows loading, and keeps labels of chosen values', async () => {
    vi.useFakeTimers()
    const wrapper = withModel({ options: [], remote: true, searchDelay: 200 })
    await open(wrapper)
    expect(wrapper.emitted('search')![0]).toEqual([''])
    await wrapper.get('input').setValue('do')
    await wrapper.get('input').setValue('dou')
    vi.advanceTimersByTime(199)
    expect(wrapper.emitted('search')).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('search')![1]).toEqual(['dou'])

    await wrapper.setProps({ loading: true } as never)
    expect(
      document.querySelector('.dou-select__loading [role="status"]')?.getAttribute('aria-label'),
    ).toBe('加载中')
    expect(document.querySelector('.dou-select__empty')).toBeNull()

    // Remote results are shown as they are, not filtered again.
    await wrapper.setProps({
      loading: false,
      options: [
        { value: 1, label: 'dou-ui' },
        { value: 2, label: 'icons' },
      ],
    } as never)
    expect(optionEls()).toHaveLength(2)
    optionEls()[1]!.click()
    await nextTick()
    expect(wrapper.props('modelValue')).toBe(2)

    await wrapper.setProps({ options: [] } as never)
    expect(wrapper.get('input').attributes('placeholder')).toBe('icons')
  })
})

describe('DouSelect creatable', () => {
  it('offers the typed text as a new option and keeps it', async () => {
    const wrapper = withModel({
      options: ['bug', 'docs'],
      creatable: true,
      multiple: true,
      modelValue: [],
    })
    await wrapper.get('input').setValue('perf')
    expect(optionEls()[0]!.textContent?.trim()).toBe('创建“perf”')
    expect(optionEls()[0]!.classList).toContain('is-create')
    key(wrapper.get('input').element, 'Enter')
    await nextTick()
    expect(wrapper.props('modelValue')).toEqual(['perf'])
    expect(wrapper.emitted('create')![0]).toEqual(['perf'])
    expect(wrapper.findAll('.dou-select__tag').map((tag) => tag.text())).toEqual(['perf'])
    // The created option is now listed like the others.
    expect(optionEls().map((el) => el.textContent?.trim())).toContain('perf')

    // An exact match is not offered again.
    await wrapper.get('input').setValue('docs')
    expect(document.querySelector('.is-create')).toBeNull()
  })
})

describe('DouSelect virtual', () => {
  it('renders only the options in view', async () => {
    const many = Array.from({ length: 2000 }, (_, i) => ({ value: i, label: `选项 ${i}` }))
    const wrapper = withModel({ options: many, virtual: true })
    await open(wrapper)
    expect(optionEls().length).toBeLessThan(30)
    const list = document.querySelector<HTMLElement>('[role="listbox"]')!
    expect(list.style.height).toBe(`${2000 * 32}px`)
    expect(optionEls()[0]!.getAttribute('aria-setsize')).toBe('2000')

    const box = wrapper.get('[role="combobox"]').element
    key(box, 'End')
    for (let i = 0; i < 4; i++) await nextTick()
    expect(box.getAttribute('aria-activedescendant')).toBe(
      optionEls().find((el) => el.getAttribute('aria-posinset') === '2000')?.id,
    )
  })
})
