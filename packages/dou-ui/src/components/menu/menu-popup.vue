<script setup lang="ts">
import { CheckIcon } from '@dou-ui/icons'
import { computed, inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouDropdown, DouDropdownItem } from '../dropdown'
import { flatten, menuKey } from './menu'
import type { MenuItemOption, MenuKey } from './menu'
import MenuItem from './menu-item.vue'

defineOptions({ name: 'DouMenuPopup' })

const props = defineProps<{
  item: MenuItemOption
  placement: 'bottom-start' | 'right-start'
  iconOnly?: boolean
}>()

const ns = useNamespace('menu')
const menu = inject(menuKey)!
const entries = computed(() => flatten(props.item.children ?? []))
const byKey = computed(
  () =>
    new Map(
      entries.value.flatMap((entry) =>
        entry.kind === 'item' ? [[entry.item.key, entry.item]] : [],
      ),
    ),
)

function onSelect(key: MenuKey | undefined) {
  const item = key === undefined ? undefined : byKey.value.get(key)
  if (item) menu.choose(item, true)
}
</script>

<template>
  <DouDropdown
    trigger="hover"
    :placement="placement"
    :offset="placement === 'right-start' ? 8 : 6"
    :disabled="item.disabled"
    @select="onSelect"
  >
    <MenuItem :item="item" kind="trigger" :icon-only="iconOnly" />
    <template #menu>
      <template v-for="(entry, index) in entries" :key="index">
        <div v-if="entry.kind === 'divider'" role="separator" class="dou-dropdown__separator" />
        <div v-else-if="entry.kind === 'label'" :class="ns.e('popup-label')" role="presentation">
          {{ entry.label }}
        </div>
        <DouDropdownItem
          v-else
          :value="entry.item.key"
          :disabled="entry.item.disabled"
          @contextmenu="menu.contextmenu(entry.item, $event)"
        >
          <template v-if="entry.item.icon" #prefix>
            <component :is="entry.item.icon" />
          </template>
          {{ entry.item.label }}
          <template v-if="menu.selected.value === entry.item.key" #suffix>
            <CheckIcon :class="ns.e('check')" />
          </template>
        </DouDropdownItem>
      </template>
    </template>
  </DouDropdown>
</template>
