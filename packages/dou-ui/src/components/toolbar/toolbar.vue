<script setup lang="ts">
import { computed, provide, useTemplateRef } from 'vue'
import { useRovingFocus } from '../../composables/use-roving-focus'
import { useNamespace } from '../../utils/namespace'
import { fieldGroupKey } from '../field-group/field-group'
import { toolbarKey } from './toolbar'
import type { ToolbarProps, ToolbarSlots } from './toolbar'

defineOptions({ name: 'DouToolbar' })

const props = withDefaults(defineProps<ToolbarProps>(), {
  orientation: 'horizontal',
  loop: true,
})
defineSlots<ToolbarSlots>()

const ns = useNamespace('toolbar')
const rootRef = useTemplateRef<HTMLElement>('root')

useRovingFocus(rootRef, { orientation: () => props.orientation, loop: props.loop })
provide(toolbarKey, { orientation: () => props.orientation })
// Controls read their size the way they do inside a field group.
provide(fieldGroupKey, { size: computed(() => props.size) })
</script>

<template>
  <div
    ref="root"
    role="toolbar"
    :class="[ns.b(), ns.m(orientation)]"
    :aria-orientation="orientation"
  >
    <slot />
  </div>
</template>
