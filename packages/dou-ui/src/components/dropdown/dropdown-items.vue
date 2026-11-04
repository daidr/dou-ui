<script setup lang="ts">
import { computed } from 'vue'
import { useCoarsePointer } from '../../utils/media'
import type { ContextMenuEntry, ContextMenuItem } from '../context-menu/context-menu'
import { DouIcon } from '../icon'
import { DouDropdownGroup, DouDropdownItem, DouDropdownRadioGroup } from './item-components'
import { isMenuGroup } from './menu-entries'

defineOptions({ name: 'DouDropdownItems' })

const props = defineProps<{ items: ContextMenuEntry[] }>()

// Shortcuts mean nothing without a keyboard.
const coarse = useCoarsePointer()

type Section =
  | { key: string; item: ContextMenuItem }
  | { key: string; label?: string; divided?: boolean; children: ContextMenuItem[]; choice: boolean }

/** Every item marked or not: one choice, read as radio items. */
const isChoice = (items: ContextMenuEntry[]): items is ContextMenuItem[] =>
  items.length > 0 && items.every((item) => !isMenuGroup(item) && item.checked !== undefined)

const sections = computed<Section[]>(() => {
  const { items } = props
  // the whole menu is one choice: a group without a heading
  if (isChoice(items)) return [{ key: 'choice', children: items, choice: true }]
  return items.map((entry, index) =>
    isMenuGroup(entry)
      ? { ...entry, key: `group:${index}`, choice: isChoice(entry.children) }
      : { key: entry.key, item: entry },
  )
})

const picked = (items: ContextMenuItem[]) => items.find((item) => item.checked)?.key
</script>

<template>
  <template v-for="section in sections" :key="section.key">
    <DouDropdownItem
      v-if="'item' in section"
      :value="section.item.key"
      :disabled="section.item.disabled"
      :tone="section.item.tone"
      :divided="section.item.divided"
      :checked="section.item.checked"
      :shortcut="coarse ? undefined : section.item.shortcut"
      :description="section.item.description"
    >
      <template v-if="section.item.icon" #prefix>
        <DouIcon><component :is="section.item.icon" /></DouIcon>
      </template>
      {{ section.item.label }}
    </DouDropdownItem>
    <component
      :is="section.choice ? DouDropdownRadioGroup : DouDropdownGroup"
      v-else
      v-bind="section.choice ? { modelValue: picked(section.children) } : {}"
      :label="section.label"
      :divided="section.divided"
    >
      <DouDropdownItem
        v-for="item in section.children"
        :key="item.key"
        :value="item.key"
        :disabled="item.disabled"
        :tone="item.tone"
        :divided="item.divided"
        :checked="section.choice ? undefined : item.checked"
        :shortcut="coarse ? undefined : item.shortcut"
        :description="item.description"
      >
        <template v-if="item.icon" #prefix>
          <DouIcon><component :is="item.icon" /></DouIcon>
        </template>
        {{ item.label }}
      </DouDropdownItem>
    </component>
  </template>
</template>
