import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import { DouTable } from '../../../index'

const Table = DouTable as Component

const data = [
  { id: 1, name: '上海' },
  { id: 2, name: '北京' },
  { id: 3, name: '杭州' },
]
const columns = [{ key: 'name', title: '名称' }]

describe('DouTable row rendering', () => {
  it('redraws only the row whose selection changed', async () => {
    const calls: number[] = []
    const Host = defineComponent({
      components: { Table },
      setup: () => ({ data, columns, selected: ref<number[]>([]), calls }),
      template: `
        <Table v-model:selected="selected" :data="data" :columns="columns" selectable>
          <template #cell-name="{ row }">{{ (calls.push(row.id), row.name) }}</template>
        </Table>`,
    })
    const wrapper = mount(Host)
    expect(calls).toEqual([1, 2, 3])
    calls.length = 0
    await wrapper.findAll('tbody input[type="checkbox"]')[1]!.setValue(true)
    expect(wrapper.findAll('tbody tr')[1]!.classes()).toContain('is-selected')
    expect(calls).toEqual([2])
  })

  it('keeps cell slots in step with the state they read', async () => {
    const suffix = ref('')
    const Host = defineComponent({
      components: { Table },
      setup: () => ({ data, columns, suffix }),
      template: `
        <Table :data="data" :columns="columns">
          <template #cell-name="{ row }">{{ row.name + suffix }}</template>
        </Table>`,
    })
    const wrapper = mount(Host)
    suffix.value = '!'
    await nextTick()
    expect(wrapper.findAll('tbody td').map((td) => td.text())).toEqual(['上海!', '北京!', '杭州!'])
  })

  it('redraws rows when slots come from a render function', async () => {
    const suffix = ref('')
    const wrapper = mount({
      render: () =>
        h(Table, { data, columns }, { cell: ({ row }: any) => `${row.name}${suffix.value}` }),
    })
    suffix.value = '?'
    await nextTick()
    expect(wrapper.findAll('tbody td').map((td) => td.text())).toEqual(['上海?', '北京?', '杭州?'])
  })

  it('redraws rows when a dynamic slot appears', async () => {
    const show = ref(false)
    const Host = defineComponent({
      components: { Table },
      setup: () => ({ data, columns, show }),
      template: `
        <Table :data="data" :columns="columns">
          <template v-if="show" #cell-name="{ row }">#{{ row.id }}</template>
        </Table>`,
    })
    const wrapper = mount(Host)
    expect(wrapper.findAll('tbody td').map((td) => td.text())).toEqual(['上海', '北京', '杭州'])
    show.value = true
    await nextTick()
    expect(wrapper.findAll('tbody td').map((td) => td.text())).toEqual(['#1', '#2', '#3'])
  })
})
