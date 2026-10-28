import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import * as exports from '../index'
import { SearchIcon, createIcon } from '../index'

const components: Record<string, unknown> = { ...exports }
import { categories, icons } from '../meta'

describe('dou-icons', () => {
  it('exports a component for every icon in the metadata', () => {
    const names = Object.keys(components).filter((key) => /^[A-Z]\w*Icon$/.test(key))
    expect(new Set(names)).toEqual(new Set(icons.map((icon) => icon.component)))
    expect(names).toHaveLength(icons.length)
  })

  it('describes every icon with a label, known categories and a variant', () => {
    expect(icons.length).toBeGreaterThan(0)
    for (const icon of icons) {
      expect(icon.label.trim()).not.toBe('')
      expect(icon.categories.length).toBeGreaterThan(0)
      for (const category of icon.categories) expect(categories).toHaveProperty(category)
      expect(icon.variant).toBe('stroke')
    }
  })

  it.each(icons.map((icon) => [icon.component]))('%s renders a line drawing', (component) => {
    const Icon = components[component] as typeof SearchIcon
    const svg = mount(Icon).find('svg')
    expect(svg.attributes()).toMatchObject({
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    })
    expect(svg.element.children.length).toBeGreaterThan(0)
  })

  it('follows the font size by default and takes a size', async () => {
    const wrapper = mount(SearchIcon)
    expect(wrapper.attributes('width')).toBe('1em')
    expect(wrapper.attributes('height')).toBe('1em')
    await wrapper.setProps({ size: 24, strokeWidth: 2 })
    expect(wrapper.attributes('width')).toBe('24')
    expect(wrapper.attributes('stroke-width')).toBe('2')
  })

  it('is decoration unless given a label', async () => {
    const wrapper = mount(SearchIcon)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.attributes('role')).toBeUndefined()
    await wrapper.setProps({ label: '搜索' })
    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('搜索')
  })

  it('passes class, style and other attributes to the svg', () => {
    const wrapper = mount(SearchIcon, {
      attrs: { class: 'extra', style: 'color: red', 'data-x': '1' },
    })
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.attributes('style')).toContain('color: red')
    expect(wrapper.attributes('data-x')).toBe('1')
  })

  it('makes custom icons with createIcon', () => {
    const Dot = createIcon('my-dot', [['circle', { cx: 8, cy: 8, r: 2 }]])
    expect(Dot.name).toBe('MyDotIcon')
    expect(mount(Dot).find('circle').attributes('r')).toBe('2')
  })
})
