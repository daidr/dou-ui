<script setup lang="ts">
import { ChevronRightIcon } from '@dou-ui/icons'
import { computed, inject, ref, useId, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { collapseKey } from './collapse'
import { CollapseTransition } from './collapse-transition'
import type { CollapseItemProps, CollapseItemSlots } from './collapse'

defineOptions({ name: 'DouCollapseItem' })

const props = withDefaults(defineProps<CollapseItemProps>(), { disabled: false })
const slots = defineSlots<CollapseItemSlots>()

const ns = useNamespace('collapse')
const collapse = inject(collapseKey, undefined)
const id = useId()

const open = computed(() => !!collapse?.open.value.includes(props.value))

// Render the content the first time the item opens, then keep it.
const visited = ref(open.value)
watch(open, (value) => {
  if (value) visited.value = true
})

function toggle() {
  if (!props.disabled) collapse?.toggle(props.value)
}
</script>

<template>
  <div :class="[ns.e('item'), ns.is('open', open), ns.is('disabled', disabled)]">
    <div role="heading" :aria-level="collapse?.headingLevel.value ?? 3" :class="ns.e('header')">
      <button
        :id="`${id}-header`"
        type="button"
        :class="ns.e('trigger')"
        :aria-expanded="open"
        :aria-controls="`${id}-panel`"
        :aria-disabled="disabled || undefined"
        @click="toggle"
      >
        <ChevronRightIcon :class="ns.e('arrow')" />
        <span :class="ns.e('title')">
          <slot name="title" :open="open">{{ title ?? value }}</slot>
        </span>
      </button>
      <div v-if="slots.extra" :class="ns.e('extra')"><slot name="extra" /></div>
    </div>
    <CollapseTransition>
      <div
        v-show="open"
        :id="`${id}-panel`"
        role="region"
        :class="ns.e('panel')"
        :aria-labelledby="`${id}-header`"
      >
        <div :class="ns.e('content')"><slot v-if="visited" /></div>
      </div>
    </CollapseTransition>
  </div>
</template>
