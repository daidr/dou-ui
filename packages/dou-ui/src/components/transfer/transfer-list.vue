<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FunctionalComponent, VNode } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouCheckbox } from '../checkbox'
import { useLocale } from '../config-provider/use-config'
import { DouInput } from '../input'
import { DouVirtualList } from '../virtual-list'
import type { TransferDirection, TransferItem, TransferKey } from './transfer'

defineOptions({ name: 'DouTransferList' })

const props = defineProps<{
  direction: TransferDirection
  title: string
  items: TransferItem[]
  checked: TransferKey[]
  filterable: boolean
  filter?: (item: TransferItem, query: string) => boolean
  height: number
  disabled: boolean
  itemSlot?: (props: { item: TransferItem; direction: TransferDirection }) => unknown
  footerSlot?: (props: { direction: TransferDirection }) => unknown
}>()
const emit = defineEmits<{ 'update:checked': [keys: TransferKey[]] }>()

const ns = useNamespace('transfer')
const { t } = useLocale()

/** Renders a slot function handed down from the transfer. */
const Render: FunctionalComponent<{ render: () => unknown }> = (renderProps) =>
  renderProps.render() as VNode[]

const query = ref('')
const visible = computed(() => {
  const text = query.value.trim()
  if (!props.filterable || !text) return props.items
  const match =
    props.filter ?? ((item: TransferItem) => item.label.toLowerCase().includes(text.toLowerCase()))
  return props.items.filter((item) => match(item, text))
})

// "all" means every visible item that can be moved
const movable = computed(() => visible.value.filter((item) => !item.disabled))
const checkedSet = computed(() => new Set(props.checked))
const checkedCount = computed(
  () => movable.value.filter((item) => checkedSet.value.has(item.key)).length,
)
const all = computed(() => movable.value.length > 0 && checkedCount.value === movable.value.length)
const some = computed(() => checkedCount.value > 0 && !all.value)

function toggleAll(value: boolean) {
  const keys = new Set(movable.value.map((item) => item.key))
  const rest = props.checked.filter((key) => !keys.has(key))
  emit('update:checked', value ? [...rest, ...keys] : rest)
}

function toggle(item: TransferItem, value: boolean) {
  emit(
    'update:checked',
    value ? [...props.checked, item.key] : props.checked.filter((key) => key !== item.key),
  )
}
</script>

<template>
  <section :class="[ns.e('list'), ns.is('disabled', disabled)]" :aria-label="title">
    <header :class="ns.e('header')">
      <DouCheckbox
        :model-value="all"
        :indeterminate="some"
        :disabled="disabled || !movable.length"
        :aria-label="t('transfer.selectAll')"
        @update:model-value="toggleAll"
      />
      <span :class="ns.e('title')">{{ title }}</span>
      <span :class="ns.e('count')">
        {{ t('transfer.count', { checked: checkedCount, total: items.length }) }}
      </span>
    </header>
    <div v-if="filterable" :class="ns.e('search')">
      <DouInput
        v-model="query"
        size="sm"
        clearable
        :disabled="disabled"
        :placeholder="t('transfer.search')"
        :aria-label="`${title} ${t('transfer.search')}`"
      >
        <template #prefix>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            width="14"
            height="14"
          >
            <circle cx="7" cy="7" r="4.25" />
            <path d="M10.25 10.25L13 13" />
          </svg>
        </template>
      </DouInput>
    </div>
    <DouVirtualList
      :class="ns.e('body')"
      :items="visible"
      :item-size="32"
      item-key="key"
      :height="height"
      role="list"
    >
      <template #default="{ item }">
        <div role="listitem" :class="ns.e('item')">
          <DouCheckbox
            :model-value="checkedSet.has(item.key)"
            :disabled="disabled || item.disabled"
            :class="ns.e('checkbox')"
            @update:model-value="toggle(item, $event)"
          >
            <span :class="ns.e('label')">
              <Render v-if="itemSlot" :render="() => itemSlot!({ item, direction })" />
              <template v-else>{{ item.label }}</template>
            </span>
            <span v-if="item.description" :class="ns.e('description')">
              {{ item.description }}
            </span>
          </DouCheckbox>
        </div>
      </template>
      <template #empty>
        <div :class="ns.e('empty')">
          {{ query.trim() ? t('transfer.noMatch') : t('transfer.empty') }}
        </div>
      </template>
    </DouVirtualList>
    <footer v-if="footerSlot" :class="ns.e('footer')">
      <Render :render="() => footerSlot!({ direction })" />
    </footer>
  </section>
</template>
