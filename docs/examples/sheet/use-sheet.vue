<script setup lang="ts">
import { DouSheet, formatCell, useSheet, type SheetWorkbook } from '@dou-ui/sheet'
import { computed, defineComponent, h, ref } from 'vue'

/** 放在 footer 插槽里的状态栏：当前单元格的地址，以及选区里数字的合计。 */
const StatusBar = defineComponent(() => {
  const { active, forEachSelected, result } = useSheet()
  const sum = computed(() => {
    let total = 0
    let count = 0
    forEachSelected((point) => {
      const value = result(point)
      if (typeof value === 'number') {
        total += value
        count++
      }
    })
    return count > 1 ? `合计 ${total.toLocaleString()}` : ''
  })
  return () =>
    h('div', { class: 'status-bar' }, [h('span', formatCell(active.value)), h('span', sum.value)])
})

const book = ref<SheetWorkbook>({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '客流',
      cells: [
        [
          { value: '门店', style: 'head' },
          { value: '周六', style: 'head' },
          { value: '周日', style: 'head' },
        ],
        ['静安店', 1280, 1460],
        ['徐汇店', 960, 1105],
        ['浦东店', 1530, 1720],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" style="height: 220px">
    <template #footer>
      <StatusBar />
    </template>
  </DouSheet>
</template>

<style scoped>
:deep(.status-bar) {
  display: flex;
  justify-content: space-between;
  padding: 4px 12px;
  border-top: 1px solid var(--dou-color-border);
  color: var(--dou-color-text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
</style>
