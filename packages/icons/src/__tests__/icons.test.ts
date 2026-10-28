import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import * as exports from '../index'
import { SearchIcon, createIcon } from '../index'

const components: Record<string, unknown> = { ...exports }
import { categories, icons } from '../meta'

describe('@dou-ui/icons', () => {
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
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    })
    expect(svg.element.children.length).toBeGreaterThan(0)
  })

  it('follows the font size by default and takes a size', async () => {
    const wrapper = mount(SearchIcon)
    const style = (wrapper.element as SVGElement).style
    expect(wrapper.attributes('width')).toBe('1em')
    expect(wrapper.attributes('height')).toBe('1em')
    expect(style.fontSize).toBe('')
    await wrapper.setProps({ size: 24 })
    expect(style.fontSize).toBe('24px')
    await wrapper.setProps({ size: '2rem' })
    expect(style.fontSize).toBe('2rem')
  })

  it('tunes the line width to the size unless given one', async () => {
    const wrapper = mount(SearchIcon)
    const style = (wrapper.element as SVGElement).style
    expect(style.getPropertyValue('--dou-icons-stroke')).toBe('calc(0.75px + 0.03125em)')
    expect(style.strokeWidth).toBe('var(--dou-icons-stroke)')
    await wrapper.setProps({ strokeWidth: 2 })
    expect(style.getPropertyValue('--dou-icons-stroke')).toBe('2px')
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

  it('draws the line width in screen pixels, not grid units', () => {
    const wrapper = mount(SearchIcon, { props: { size: 48 } })
    for (const shape of wrapper.findAll('circle, path')) {
      expect(shape.attributes('vector-effect')).toBe('non-scaling-stroke')
    }
  })

  it('draws dots a little heavier than lines', () => {
    const Dot = createIcon('my-dot', [['dot', { cx: 12, cy: 8 }]])
    const path = mount(Dot).find('path')
    expect(path.attributes('d')).toBe('M12 8h.01')
    expect((path.element as SVGElement).style.strokeWidth).toBe(
      'calc(var(--dou-icons-stroke) * 1.5)',
    )
  })

  it('makes custom icons with createIcon', () => {
    const Dot = createIcon('my-dot', [['circle', { cx: 12, cy: 12, r: 2 }]])
    expect(Dot.name).toBe('MyDotIcon')
    expect(mount(Dot).find('circle').attributes('r')).toBe('2')
  })
})
