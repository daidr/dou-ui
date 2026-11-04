<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon } from '@dou-ui/icons'
import { computed, reactive, ref, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormSize } from '../form/use-form-item'
import { DouInputNumber as DouInputNumberComponent } from '../input-number'
import type { InputHTMLAttributes } from 'vue'
import type { WithAttributes } from '../../utils/install'
import { DouPopover } from '../popover'
import { DouSelect } from '../select'
import PaginationGap from './pagination-gap.vue'
import type { SelectValue } from '../select/select'
import type { PaginationProps } from './pagination'
import { paginationRange } from './range'

// 让模板里也能写这个组件转交的原生属性
const DouInputNumber = DouInputNumberComponent as WithAttributes<
  typeof DouInputNumberComponent,
  InputHTMLAttributes
>

defineOptions({ name: 'DouPagination' })

const props = withDefaults(defineProps<PaginationProps>(), {
  siblings: 1,
  boundaries: 1,
  simple: false,
  showTotal: false,
  showJumper: false,
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

// The pages behind each ellipsis, offered in a list when it is pressed.
const gaps = computed(() => {
  const result: Record<string, { from: number; to: number; before: boolean }> = {}
  items.value.forEach((item, index) => {
    if (item.type !== 'ellipsis') return
    const prev = items.value[index - 1]
    const next = items.value[index + 1]
    const from = prev?.type === 'page' ? prev.page + 1 : 1
    const to = next?.type === 'page' ? next.page - 1 : count.value
    result[item.key] = { from, to, before: to < current.value }
  })
  return result
})
const gapOpen = reactive<Record<string, boolean>>({})

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

// The jump box shows the current page; Enter or leaving it goes to what was typed.
const jump = ref<number | null>(current.value)
watch(current, (value) => (jump.value = value))
function commitJump() {
  if (jump.value === null) jump.value = current.value
  else go(jump.value)
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
      <ChevronLeftIcon />
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
        <DouPopover
          v-else
          v-model:open="gapOpen[item.key]"
          trigger="click"
          placement="bottom"
          :disabled="disabled"
          :class="ns.e('gap')"
          :aria-label="t('pagination.gap', { from: gaps[item.key]!.from, to: gaps[item.key]!.to })"
        >
          <button
            type="button"
            :class="[ns.e('item'), ns.e('ellipsis'), ns.is('open', !!gapOpen[item.key])]"
            :disabled="disabled"
            :aria-label="
              t('pagination.gap', { from: gaps[item.key]!.from, to: gaps[item.key]!.to })
            "
          >
            …
          </button>
          <template #content="{ close }">
            <PaginationGap
              v-if="gapOpen[item.key]"
              v-bind="gaps[item.key]!"
              @pick="
                (target) => {
                  close()
                  go(target)
                }
              "
            />
          </template>
        </DouPopover>
      </li>
    </ul>
    <button
      type="button"
      :class="[ns.e('item'), ns.e('step')]"
      :disabled="disabled || current >= count"
      :aria-label="t('pagination.next')"
      @click="go(current + 1)"
    >
      <ChevronRightIcon />
    </button>
    <span v-if="showJumper" :class="ns.e('jumper')">
      <span>{{ t('pagination.jumpPrefix') }}</span>
      <DouInputNumber
        v-model="jump"
        :class="ns.e('jump')"
        :min="1"
        :max="count"
        :step="1"
        :precision="0"
        :controls="false"
        :size="size"
        :disabled="disabled"
        :aria-label="t('pagination.jumpLabel')"
        @change="commitJump"
        @keydown.enter="commitJump"
      />
      <span v-if="t('pagination.jumpSuffix')">{{ t('pagination.jumpSuffix') }}</span>
    </span>
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
