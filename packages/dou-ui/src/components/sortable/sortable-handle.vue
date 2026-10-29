<script setup lang="ts">
import { GripVerticalIcon } from '@dou-ui/icons'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { SortableHandleProps } from './sortable'

defineOptions({ name: 'DouSortableHandle' })

defineProps<SortableHandleProps>()
defineSlots<{ default?: () => unknown }>()

const ns = useNamespace('sortable')
const { t } = useLocale()
</script>

<template>
  <button
    type="button"
    :class="ns.e('handle')"
    data-dou-sortable-handle
    :aria-label="label ?? t('sortable.handle')"
    :aria-description="t('sortable.hint')"
  >
    <slot><GripVerticalIcon /></slot>
  </button>
</template>
