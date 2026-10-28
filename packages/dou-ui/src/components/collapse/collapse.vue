<script setup lang="ts">
import { computed, provide } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { collapseKey } from './collapse'
import type { CollapseProps, CollapseSlots, CollapseValue } from './collapse'

defineOptions({ name: 'DouCollapse' })

const props = withDefaults(defineProps<CollapseProps>(), {
  accordion: false,
  bordered: false,
  headingLevel: 3,
})
const model = defineModel<CollapseValue[]>({ default: () => [] })
const emit = defineEmits<{ change: [value: CollapseValue, open: boolean] }>()
defineSlots<CollapseSlots>()

const ns = useNamespace('collapse')

function toggle(value: CollapseValue) {
  const open = model.value.includes(value)
  if (open) model.value = model.value.filter((item) => item !== value)
  else model.value = props.accordion ? [value] : [...model.value, value]
  emit('change', value, !open)
}

provide(collapseKey, {
  open: computed(() => model.value),
  headingLevel: computed(() => props.headingLevel),
  toggle,
})
</script>

<template>
  <div :class="[ns.b(), ns.is('bordered', bordered)]">
    <slot />
  </div>
</template>
