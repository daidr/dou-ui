import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouMasonry, placeItems } from '../../../index'
import type { Responsive } from '../../../index'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('placeItems', () => {
  it('puts each item at the top of the shortest column', () => {
    const { placements, height } = placeItems([100, 40, 60, 30, 50], 3, 10)
    expect(placements).toEqual([
      { column: 0, top: 0 },
      { column: 1, top: 0 },
      { column: 2, top: 0 },
      { column: 1, top: 50 },
      { column: 2, top: 70 },
    ])
    expect(height).toBe(120)
  })

  it('is empty without items', () => {
    expect(placeItems([], 2, 8).height).toBe(0)
  })
})

describe('DouMasonry', () => {
  const heights = [100, 40, 60, 30]

  function setup(columns: Responsive<number> = 2, width = 1200) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn<(query: string) => unknown>((query) => ({
        matches: width >= Number(/(\d+)px/.exec(query)?.[1] ?? 0),
        addEventListener() {},
        removeEventListener() {},
      })),
    )
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return heights[Number(this.textContent)] ?? 0
    })
    return mount(DouMasonry, {
      props: { items: [0, 1, 2, 3], columns },
      slots: { default: ({ item }: { item: number }) => h('span', String(item)) },
      attachTo: document.body,
    })
  }

  it('flows as a grid, then places items in columns in their own DOM order', async () => {
    const wrapper = setup()
    await nextTick()
    await nextTick()
    const root = wrapper.get('.dou-masonry')
    expect(root.classes()).toContain('is-placed')
    const items = wrapper.findAll('.dou-masonry__item')
    expect(items.map((item) => item.text())).toEqual(['0', '1', '2', '3'])
    expect(items.map((item) => item.attributes('style'))).toEqual([
      expect.stringContaining('--dou-masonry-col: 0; --dou-masonry-top: 0px'),
      expect.stringContaining('--dou-masonry-col: 1; --dou-masonry-top: 0px'),
      expect.stringContaining('--dou-masonry-col: 1; --dou-masonry-top: 40px'),
      expect.stringContaining('--dou-masonry-col: 0; --dou-masonry-top: 100px'),
    ])
    expect(root.attributes('style')).toContain('height: 130px')
    wrapper.unmount()
  })

  it('takes the column count for the viewport', async () => {
    const wrapper = setup({ base: 1, md: 4 }, 800)
    await nextTick()
    await nextTick()
    expect(wrapper.get('.dou-masonry').attributes('style')).toContain('--dou-masonry-cols: 4')
    wrapper.unmount()
    const narrow = setup({ base: 1, md: 4 }, 400)
    await nextTick()
    expect(narrow.get('.dou-masonry').attributes('style')).toContain('--dou-masonry-cols: 1')
    narrow.unmount()
  })
})
