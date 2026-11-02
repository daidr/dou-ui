<script setup lang="ts">
import {
  DouSheet,
  defineSheetCellType,
  defineSheetExtension,
  type SheetCellRenderProps,
  type SheetWorkbook,
} from '@dou-ui/sheet'
import { StarIcon } from '@dou-ui/icons'
import { defineComponent, h, ref } from 'vue'

/** 评分：0 到 5 的整数，画成五颗星；不是评分的值只显示文字。 */
const Stars = defineComponent<SheetCellRenderProps>(
  (props) => () => {
    if (typeof props.value !== 'number') return h('span', { class: 'dou-sheet__text' }, props.text)
    return h(
      'span',
      { class: 'rating-cell', 'aria-hidden': 'true' },
      Array.from({ length: 5 }, (_, i) =>
        h(StarIcon, { class: i < Number(props.value) ? 'is-on' : undefined }),
      ),
    )
  },
  { props: ['value', 'text', 'setup', 'readonly'] },
)

const rating = defineSheetCellType({
  name: 'rating',
  parse: (text) => {
    const n = Number.parseInt(text, 10)
    return Number.isNaN(n) ? undefined : { value: n }
  },
  format: (value) => (typeof value === 'number' ? `${value} 星` : undefined),
  edit: (value) => (typeof value === 'number' ? String(value) : undefined),
  valid: (value) =>
    (Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 5) || '评分要填 0 到 5',
  render: Stars,
  plain: (value) => value,
})

const extensions = [defineSheetExtension({ name: 'rating', cellTypes: [rating] })]

const head = (value: string) => ({ value, style: 'head' })
const book = ref<SheetWorkbook>({
  version: 1,
  styles: { head: { bold: true, fill: 'neutral' } },
  sheets: [
    {
      name: '门店评分',
      colSizes: { 0: 120, 1: 140 },
      cells: [
        [head('门店'), head('评分'), head('点评数')],
        ['静安店', { value: 5, type: 'rating' }, 286],
        ['徐汇店', { value: 4, type: 'rating' }, 193],
        ['浦东店', { value: 3, type: 'rating' }, 147],
        ['虹口店', { value: 4, type: 'rating' }, 88],
      ],
    },
  ],
})
</script>

<template>
  <DouSheet v-model="book" :extensions="extensions" style="height: 220px" />
</template>

<style scoped>
:deep(.rating-cell) {
  display: inline-flex;
  gap: 2px;
  color: var(--dou-color-text-tertiary);
  font-size: 14px;
}
:deep(.rating-cell .is-on) {
  color: var(--dou-color-warning);
}
</style>
