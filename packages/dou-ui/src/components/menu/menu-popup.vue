<script setup lang="ts">
import { CheckIcon } from '@dou-ui/icons'
import { computed, h, inject, useId } from 'vue'
import type { FunctionalComponent, VNode } from 'vue'
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
        (entry.kind === 'group' ? entry.rows : [entry]).flatMap((row) =>
          row.kind === 'item' ? [[row.item.key, row.item] as const] : [],
        ),
      ),
    ),
)

const id = useId()

/** The label and description slots of the menu, with the item's own text when they are not given. */
const label = (item: MenuItemOption) =>
  (menu.labelSlot()?.({ item, selected: menu.selected.value === item.key }) as
    VNode[] | undefined) ?? item.label
const description = (item: MenuItemOption) =>
  (menu.descriptionSlot()?.({ item, selected: menu.selected.value === item.key }) as
    VNode[] | undefined) ?? item.description

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
      default: () => label(item),
      description: item.description ? () => description(item) : undefined,
      suffix:
        menu.selected.value === item.key ? () => h(CheckIcon, { class: ns.e('check') }) : undefined,
    },
  )
MenuPopupItem.props = ['item']

const MenuText: FunctionalComponent<{ item: MenuItemOption; part: 'label' | 'description' }> = ({
  item,
  part,
}) => (part === 'label' ? label(item) : description(item))
MenuText.props = ['item', 'part']

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
        <!-- a deeper submenu becomes a heading: too small for its description, which is only read -->
        <DouDropdownGroup
          v-else-if="entry.kind === 'group'"
          :label="entry.item ? undefined : entry.label"
          :aria-describedby="entry.item?.description ? `${id}-description-${index}` : undefined"
        >
          <template v-if="entry.item" #label><MenuText :item="entry.item" part="label" /></template>
          <span v-if="entry.item?.description" :id="`${id}-description-${index}`" hidden
            ><MenuText :item="entry.item" part="description"
          /></span>
          <template v-for="(row, at) in entry.rows" :key="at">
            <div v-if="row.kind === 'divider'" role="separator" class="dou-dropdown__separator" />
            <MenuPopupItem v-else :item="row.item" />
          </template>
        </DouDropdownGroup>
        <MenuPopupItem v-else :item="entry.item" />
      </template>
    </template>
  </DouDropdown>
</template>
