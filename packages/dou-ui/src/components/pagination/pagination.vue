<script setup lang="ts">
import { computed, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormSize } from '../form/use-form-item'
import DouSelect from '../select/select.vue'
import type { SelectValue } from '../select/select'
import type { PaginationProps } from './pagination'
import { paginationRange } from './range'

defineOptions({ name: 'DouPagination' })

const props = withDefaults(defineProps<PaginationProps>(), {
  siblings: 1,
  boundaries: 1,
  simple: false,
  showTotal: false,
  hideOnSinglePage: false,
  disabled: false,
})
const page = defineModel<number>('page', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 10 })
const emit = defineEmits<{ change: [page: number, pageSize: number] }>()

const ns = useNamespace('pagination')
const { t } = useLocale()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)

const count = computed(() => Math.max(1, Math.ceil(props.total / Math.max(1, pageSize.value))))
const current = computed(() => Math.min(Math.max(1, Math.floor(page.value)), count.value))

// Keep the page in range when the total or the page size shrinks.
watch(count, (value) => {
  if (page.value > value) page.value = value
})

const items = computed(() =>
  paginationRange(
    current.value,
    count.value,
    Math.max(0, props.siblings),
    Math.max(1, props.boundaries),
  ),
)

function go(target: number) {
  const next = Math.min(Math.max(1, target), count.value)
  if (disabled.value || next === current.value) return
  page.value = next
  emit('change', next, pageSize.value)
}

const sizeOptions = computed(() =>
  (props.pageSizes ?? []).map((value) => ({
    value,
    label: t('pagination.pageSize', { size: value }),
  })),
)

function changePageSize(value: SelectValue | SelectValue[] | null | undefined) {
  if (typeof value !== 'number' || value === pageSize.value) return
  // Stay on the page that holds the first item currently shown.
  const first = (current.value - 1) * pageSize.value
  pageSize.value = value
  const next = Math.floor(first / value) + 1
  page.value = next
  emit('change', next, value)
}

const hidden = computed(() => props.hideOnSinglePage && count.value <= 1)
</script>

<template>
  <nav
    v-if="!hidden"
    :class="[ns.b(), ns.m(size), ns.is('disabled', disabled)]"
    :aria-label="t('pagination.label')"
  >
    <span v-if="showTotal" :class="ns.e('total')">{{ t('pagination.total', { total }) }}</span>
    <button
      type="button"
      :class="[ns.e('item'), ns.e('step')]"
      :disabled="disabled || current <= 1"
      :aria-label="t('pagination.prev')"
      @click="go(current - 1)"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <path d="M10 3.5L5.5 8l4.5 4.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <span v-if="simple" :class="ns.e('simple')">
      <span :class="ns.e('current')">{{ current }}</span>
      <span :class="ns.e('slash')">/</span>
      <span>{{ count }}</span>
    </span>
    <ul v-else :class="ns.e('pages')">
      <li v-for="item in items" :key="item.type === 'page' ? item.page : item.key">
        <button
          v-if="item.type === 'page'"
          type="button"
          :class="[ns.e('item'), ns.is('current', item.page === current)]"
          :disabled="disabled"
          :aria-label="t('pagination.page', { page: item.page })"
          :aria-current="item.page === current ? 'page' : undefined"
          @click="go(item.page)"
        >
          <span :class="ns.e('number')">{{ item.page }}</span>
        </button>
        <span v-else :class="[ns.e('item'), ns.e('ellipsis')]" aria-hidden="true">…</span>
      </li>
    </ul>
    <button
      type="button"
      :class="[ns.e('item'), ns.e('step')]"
      :disabled="disabled || current >= count"
      :aria-label="t('pagination.next')"
      @click="go(current + 1)"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <path d="M6 3.5L10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <span v-if="sizeOptions.length" :class="ns.e('sizes')">
      <DouSelect
        :model-value="pageSize"
        :options="sizeOptions"
        :size="size"
        :disabled="disabled"
        :aria-label="t('pagination.pageSizeLabel')"
        @update:model-value="changePageSize"
      />
    </span>
  </nav>
</template>
