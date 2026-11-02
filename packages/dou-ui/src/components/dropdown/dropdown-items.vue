<script setup lang="ts">
import { computed } from 'vue'
import { useCoarsePointer } from '../../utils/media'
import type { ContextMenuItem } from '../context-menu/context-menu'
import { DouIcon } from '../icon'
import DouDropdownItem from './dropdown-item.vue'
import DouDropdownRadioGroup from './dropdown-radio-group.vue'

defineOptions({ name: 'DouDropdownItems' })

const props = defineProps<{ items: ContextMenuItem[] }>()

// Shortcuts mean nothing without a keyboard.
const coarse = useCoarsePointer()

/** Every item marked or not: one choice, read as radio items. */
const choice = computed(
  () => props.items.length > 0 && props.items.every((item) => item.checked !== undefined),
)
const picked = computed(() => props.items.find((item) => item.checked)?.key)
</script>

<template>
  <DouDropdownRadioGroup v-if="choice" :model-value="picked">
    <DouDropdownItem
      v-for="item in items"
      :key="item.key"
      :value="item.key"
      :disabled="item.disabled"
      :tone="item.tone"
      :divided="item.divided"
      :shortcut="coarse ? undefined : item.shortcut"
    >
      <template v-if="item.icon" #prefix>
        <DouIcon><component :is="item.icon" /></DouIcon>
      </template>
      {{ item.label }}
    </DouDropdownItem>
  </DouDropdownRadioGroup>
  <template v-else>
    <DouDropdownItem
      v-for="item in items"
      :key="item.key"
      :value="item.key"
      :disabled="item.disabled"
      :tone="item.tone"
      :divided="item.divided"
      :checked="item.checked"
      :shortcut="coarse ? undefined : item.shortcut"
    >
      <template v-if="item.icon" #prefix>
        <DouIcon><component :is="item.icon" /></DouIcon>
      </template>
      {{ item.label }}
    </DouDropdownItem>
  </template>
</template>
