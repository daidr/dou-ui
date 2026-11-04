<script setup lang="ts">
import { useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { DropdownGroupProps, DropdownGroupSlots } from './dropdown'

defineOptions({ name: 'DouDropdownGroup', inheritAttrs: false })

const props = withDefaults(defineProps<DropdownGroupProps>(), { divided: false })
const slots = defineSlots<DropdownGroupSlots>()

const ns = useNamespace('dropdown')
const id = `dou-dropdown-group-${useId()}`

// Read while rendering: slots are not reactive, a computed would miss one added later.
const titled = () => !!(slots.label || props.label)
</script>

<template>
  <div v-if="divided" role="separator" :class="ns.e('separator')" />
  <div
    v-bind="$attrs"
    role="group"
    :class="ns.e('group')"
    :aria-labelledby="titled() ? id : undefined"
  >
    <!-- the group is named by it; hidden so it is not read a second time as loose text -->
    <div v-if="titled()" :id="id" :class="ns.e('group-label')" aria-hidden="true">
      <slot name="label">{{ label }}</slot>
    </div>
    <slot />
  </div>
</template>
