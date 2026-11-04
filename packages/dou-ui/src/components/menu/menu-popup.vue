<script setup lang="ts">
import { CheckIcon } from '@dou-ui/icons'
import { computed, h, inject } from 'vue'
import type { FunctionalComponent } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouDropdown, DouDropdownGroup, DouDropdownItem } from '../dropdown'
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
        (entry.kind === 'item' ? [entry.item] : entry.kind === 'group' ? entry.items : []).map(
          (item) => [item.key, item] as const,
        ),
      ),
    ),
)

/** One item of the popup; the current one shows a check at the end. */
const MenuPopupItem: FunctionalComponent<{ item: MenuItemOption }> = ({ item }) =>
  h(
    DouDropdownItem,
    {
      value: item.key,
      disabled: item.disabled,
      onContextmenu: (event: MouseEvent) => menu.contextmenu(item, event),
    },
    {
      prefix: item.icon ? () => h(item.icon!) : undefined,
      default: () => item.label,
      suffix:
        menu.selected.value === item.key ? () => h(CheckIcon, { class: ns.e('check') }) : undefined,
    },
  )
MenuPopupItem.props = ['item']

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
        <DouDropdownGroup v-else-if="entry.kind === 'group'" :label="entry.label">
          <template v-for="item in entry.items" :key="item.key">
            <MenuPopupItem :item="item" />
          </template>
        </DouDropdownGroup>
        <MenuPopupItem v-else :item="entry.item" />
      </template>
    </template>
  </DouDropdown>
</template>
