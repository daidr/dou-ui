import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouTree } from '../../../index'
import type { TreeKey, TreeNodeData } from '../../../index'

const data: TreeNodeData[] = [
  {
    key: 'src',
    label: 'src',
    children: [
      {
        key: 'components',
        label: 'components',
        children: [
          { key: 'button', label: 'button.vue' },
          { key: 'input', label: 'input.vue' },
        ],
      },
      { key: 'index', label: 'index.ts' },
    ],
  },
  { key: 'readme', label: 'README.md' },
  { key: 'locked', label: 'locked', disabled: true },
]

function make(props: Record<string, unknown> = {}) {
  const state = {
    expanded: ref(props.expanded as TreeKey[] | undefined),
    selected: ref(props.selected as TreeKey | null | undefined),
    checked: ref(props.checked as TreeKey[] | undefined),
  }
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(DouTree, {
            data,
            ...props,
            expanded: state.expanded.value,
            'onUpdate:expanded': (value?: TreeKey[]) => (state.expanded.value = value),
            selected: state.selected.value,
            'onUpdate:selected': (value?: TreeKey | null) => (state.selected.value = value),
            checked: state.checked.value,
            'onUpdate:checked': (value?: TreeKey[]) => (state.checked.value = value),
          })
      },
    }),
    { attachTo: document.body },
  )
  const items = () => wrapper.findAll('[role="treeitem"]')
  const labels = () => items().map((item) => item.text())
  const tree = () => wrapper.get('[role="tree"]')
  const key = (name: string) => tree().trigger('keydown', { key: name })
  return { wrapper, state, items, labels, tree, key }
}

describe('DouTree', () => {
  it('renders the top level with tree semantics', () => {
    const { wrapper, items, labels } = make()
    expect(labels()).toEqual(['src', 'README.md', 'locked'])
    const [src, readme, locked] = items()
    expect(src!.attributes('aria-level')).toBe('1')
    expect(src!.attributes('aria-expanded')).toBe('false')
    expect(src!.attributes('aria-setsize')).toBe('3')
    expect(readme!.attributes('aria-posinset')).toBe('2')
    expect(readme!.attributes('aria-expanded')).toBeUndefined()
    expect(locked!.attributes('aria-disabled')).toBe('true')
    wrapper.unmount()
  })

  it('opens branches from the chevron and with defaultExpandAll', async () => {
    const { wrapper, state, labels } = make()
    await wrapper.get('.dou-tree__toggle').trigger('click')
    expect(state.expanded.value).toEqual(['src'])
    expect(labels()).toEqual(['src', 'components', 'index.ts', 'README.md', 'locked'])
    wrapper.unmount()

    const all = make({ defaultExpandAll: true })
    await nextTick()
    expect(all.labels()).toContain('button.vue')
    all.wrapper.unmount()
  })

  it('selects on click and skips disabled nodes', async () => {
    const { wrapper, state, items } = make()
    await items()[1]!.trigger('click')
    expect(state.selected.value).toBe('readme')
    expect(items()[1]!.attributes('aria-selected')).toBe('true')
    await items()[2]!.trigger('click')
    expect(state.selected.value).toBe('readme')
    expect(wrapper.findComponent(DouTree).emitted('select')).toHaveLength(1)
    wrapper.unmount()
  })

  it('moves with the arrow keys and opens with right', async () => {
    const { wrapper, state, tree, key } = make()
    await tree().trigger('focus')
    const active = () => tree().attributes('aria-activedescendant')
    const idOf = (label: string) =>
      wrapper
        .findAll('[role="treeitem"]')
        .find((item) => item.text() === label)!
        .attributes('id')
    expect(active()).toBe(idOf('src'))
    await key('ArrowRight')
    expect(state.expanded.value).toEqual(['src'])
    await key('ArrowRight')
    expect(active()).toBe(idOf('components'))
    await key('ArrowDown')
    await key('ArrowDown')
    expect(active()).toBe(idOf('README.md'))
    await key('ArrowUp')
    await key('ArrowLeft')
    // index.ts is a leaf: left goes to the parent
    expect(active()).toBe(idOf('src'))
    await key('ArrowLeft')
    expect(state.expanded.value).toEqual([])
    await key('End')
    expect(active()).toBe(idOf('locked'))
    await key('Home')
    await key('Enter')
    expect(state.selected.value).toBe('src')
    await key('r')
    expect(active()).toBe(idOf('README.md'))
    wrapper.unmount()
  })

  it('cascades checks down and up', async () => {
    const { wrapper, state, items } = make({ checkable: true, defaultExpandAll: true })
    await nextTick()
    const box = (label: string) =>
      items()
        .find((item) => item.text() === label)!
        .get('.dou-tree__checkbox')
    await box('button.vue').trigger('click')
    expect(state.checked.value).toEqual(['button'])
    const components = items().find((item) => item.text() === 'components')!
    expect(components.attributes('aria-checked')).toBe('mixed')

    await box('input.vue').trigger('click')
    expect(state.checked.value).toEqual(['components', 'button', 'input'])
    await box('index.ts').trigger('click')
    expect(state.checked.value).toEqual(['src', 'components', 'button', 'input', 'index'])

    await box('src').trigger('click')
    expect(state.checked.value).toEqual([])
    wrapper.unmount()
  })

  it('reads a checked branch as checking its children', async () => {
    const { wrapper, items } = make({
      checkable: true,
      checked: ['components'],
      expanded: ['src', 'components'],
    })
    await nextTick()
    const state = (label: string) =>
      items()
        .find((item) => item.text() === label)!
        .attributes('aria-checked')
    expect(state('button.vue')).toBe('true')
    expect(state('src')).toBe('mixed')
    wrapper.unmount()
  })

  it('checks each node on its own with checkStrictly', async () => {
    const { wrapper, state, items } = make({ checkable: true, checkStrictly: true })
    await items()[0]!.get('.dou-tree__checkbox').trigger('click')
    expect(state.checked.value).toEqual(['src'])
    wrapper.unmount()
  })

  it('filters and reveals matches', async () => {
    const { wrapper, labels } = make({ filter: 'INPUT' })
    await nextTick()
    expect(labels()).toEqual(['src', 'components', 'input.vue'])
    expect(wrapper.get('.dou-tree__match').text()).toBe('input')
    // the highlight sits in one text run with the rest of the label
    expect(wrapper.get('.dou-tree__match').element.parentElement!.className).toBe('dou-tree__text')
    wrapper.unmount()

    const none = make({ filter: 'nothing' })
    expect(none.wrapper.get('.dou-tree__empty').text()).toBe('暂无数据')
    none.wrapper.unmount()
  })

  it('loads children on first open', async () => {
    let resolve!: (nodes: TreeNodeData[]) => void
    const load = () => new Promise<TreeNodeData[]>((done) => (resolve = done))
    const { wrapper, items, labels } = make({ data: [{ key: 'remote', label: 'remote' }], load })
    expect(items()[0]!.attributes('aria-expanded')).toBe('false')
    await wrapper.get('.dou-tree__toggle').trigger('click')
    expect(items()[0]!.attributes('aria-busy')).toBe('true')
    resolve([{ key: 'child', label: 'child', isLeaf: true }])
    await new Promise((done) => setTimeout(done))
    expect(labels()).toEqual(['remote', 'child'])
    expect(items()[0]!.attributes('aria-busy')).toBeUndefined()
    wrapper.unmount()
  })

  it('virtualizes rows with a height', async () => {
    const many: TreeNodeData[] = Array.from({ length: 500 }, (_, index) => ({
      key: index,
      label: `节点 ${index}`,
    }))
    const { wrapper, items } = make({ data: many, height: 280 })
    // 280 / 28 = 10 in view, 6 overscan
    expect(items()).toHaveLength(16)
    expect(items()[0]!.attributes('aria-setsize')).toBe('500')
    wrapper.unmount()
  })
})
