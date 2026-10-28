<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem } from '../form/use-form-item'
import TransferList from './transfer-list.vue'
import type { TransferItem, TransferKey, TransferProps, TransferSlots } from './transfer'

defineOptions({ name: 'DouTransfer' })

const props = withDefaults(defineProps<TransferProps>(), {
  data: () => [],
  filterable: false,
  height: 240,
  disabled: false,
})
const model = defineModel<TransferKey[]>({ default: () => [] })
const emit = defineEmits<{
  change: [value: TransferKey[], direction: 'source' | 'target', moved: TransferKey[]]
}>()
const slots = defineSlots<TransferSlots>()

const ns = useNamespace('transfer')
const { t } = useLocale()
const { formItem } = useFormItem()
formItem?.markGroup()
const disabled = useFormDisabled(() => props.disabled)

const byKey = computed(() => new Map(props.data.map((item) => [item.key, item])))
const targetSet = computed(() => new Set(model.value))
const source = computed(() => props.data.filter((item) => !targetSet.value.has(item.key)))
const target = computed(() =>
  model.value.map((key) => byKey.value.get(key)).filter((item): item is TransferItem => !!item),
)

const checkedSource = ref<TransferKey[]>([])
const checkedTarget = ref<TransferKey[]>([])
// forget checks on items that moved away or vanished
watch([source, target], () => {
  const inSource = new Set(source.value.map((item) => item.key))
  checkedSource.value = checkedSource.value.filter((key) => inSource.has(key))
  checkedTarget.value = checkedTarget.value.filter((key) => targetSet.value.has(key))
})

const movable = (keys: TransferKey[]) => keys.filter((key) => !byKey.value.get(key)?.disabled)

function toTarget() {
  const moved = movable(checkedSource.value)
  if (!moved.length) return
  const value = [...model.value, ...moved]
  model.value = value
  checkedSource.value = []
  emit('change', value, 'target', moved)
  formItem?.trigger('change')
}

function toSource() {
  const moved = new Set(movable(checkedTarget.value))
  if (!moved.size) return
  const value = model.value.filter((key) => !moved.has(key))
  model.value = value
  checkedTarget.value = []
  emit('change', value, 'source', [...moved])
  formItem?.trigger('change')
}

const titles = computed<[string, string]>(
  () => props.titles ?? [t('transfer.source'), t('transfer.target')],
)
</script>

<template>
  <div
    :class="[ns.b(), ns.is('disabled', disabled)]"
    role="group"
    :aria-labelledby="formItem?.labelId"
    :aria-describedby="formItem?.describedBy.value"
  >
    <TransferList
      v-model:checked="checkedSource"
      direction="source"
      :title="titles[0]"
      :items="source"
      :filterable="filterable"
      :filter="filter"
      :height="height"
      :disabled="disabled"
      :item-slot="slots.item"
      :footer-slot="slots.footer"
    />
    <div :class="ns.e('actions')">
      <DouButton
        size="sm"
        variant="outline"
        :disabled="disabled || !movable(checkedSource).length"
        :aria-label="t('transfer.toTarget')"
        @click="toTarget"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          width="14"
          height="14"
        >
          <path d="M6 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </DouButton>
      <DouButton
        size="sm"
        variant="outline"
        :disabled="disabled || !movable(checkedTarget).length"
        :aria-label="t('transfer.toSource')"
        @click="toSource"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          width="14"
          height="14"
        >
          <path d="M10 4L6 8l4 4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </DouButton>
    </div>
    <TransferList
      v-model:checked="checkedTarget"
      direction="target"
      :title="titles[1]"
      :items="target"
      :filterable="filterable"
      :filter="filter"
      :height="height"
      :disabled="disabled"
      :item-slot="slots.item"
      :footer-slot="slots.footer"
    />
  </div>
</template>
