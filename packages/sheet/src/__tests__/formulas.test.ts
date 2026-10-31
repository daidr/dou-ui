import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import type { SheetWorkbook } from '../core/model'
import { DouSheet, useSheetFormulas } from '../index'
import type { SheetExpose } from '../types'

describe('useSheetFormulas', () => {
  it('reads results reactively, catching up with each transaction', async () => {
    const book = ref<SheetWorkbook>({
      sheets: [{ name: '表', cells: [[1, 2, '=A1+B1']] }],
    })
    const grid = ref<SheetExpose>()
    let total!: { value: unknown }
    let load!: ReturnType<typeof vi.spyOn>
    const wrapper = mount(
      defineComponent(() => {
        const formulas = useSheetFormulas(book)
        load = vi.spyOn(formulas.engine, 'load')
        total = computed(() => formulas.result(0, 'C1'))
        return () =>
          h(DouSheet, {
            ref: grid,
            modelValue: book.value,
            'onUpdate:modelValue': (value: SheetWorkbook) => (book.value = value),
            onTransaction: formulas.update,
          })
      }),
      { attachTo: document.body },
    )
    expect(total.value).toBe(3)
    grid.value!.transact((tr) => tr.setValue('A1', 10))
    await nextTick()
    expect(total.value).toBe(12)
    // the transaction was enough: nothing was worked out from scratch
    expect(load).not.toHaveBeenCalled()

    // a workbook replaced from outside is loaded again
    book.value = { sheets: [{ name: '表', cells: [[5, 5, '=A1*B1']] }] }
    await nextTick()
    expect(total.value).toBe(25)
    wrapper.unmount()
  })
})
