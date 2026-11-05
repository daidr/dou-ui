<script setup lang="ts">
import { inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouCollapseTransition as CollapseTransition } from '../collapse/collapse-transition'
import { isDivider, isGroup, menuKey } from './menu'
import type { MenuOption } from './menu'
import MenuActions from './menu-actions.vue'
import MenuItem from './menu-item.vue'

defineOptions({ name: 'DouMenuList' })

defineProps<{ options: MenuOption[]; level: number }>()

const ns = useNamespace('menu')
const menu = inject(menuKey)!
</script>

<template>
  <template v-for="(option, index) in options" :key="'key' in option ? option.key : index">
    <li v-if="isDivider(option)" :class="ns.e('divider')" aria-hidden="true" />
    <li v-else-if="isGroup(option)" :class="ns.e('group')">
      <div
        :class="ns.e('group-label')"
        :style="level ? { '--dou-menu-level': level } : undefined"
        aria-hidden="true"
      >
        {{ option.label }}
      </div>
      <ul :class="ns.e('list')" :aria-label="option.label">
        <DouMenuList :options="option.children" :level="level" />
      </ul>
    </li>
    <li v-else-if="option.children?.length" :class="ns.e('entry')">
      <MenuItem :item="option" :level="level" kind="submenu" stacked />
      <MenuActions :item="option" :selected="false" />
      <CollapseTransition>
        <ul
          v-show="menu.isExpanded(option.key)"
          :id="menu.subId(option.key)"
          :class="[ns.e('list'), ns.e('sub')]"
        >
          <DouMenuList :options="option.children" :level="level + 1" />
        </ul>
      </CollapseTransition>
    </li>
    <li v-else :class="[ns.e('entry'), ns.is('current', menu.selected.value === option.key)]">
      <MenuItem :item="option" :level="level" stacked />
      <MenuActions :item="option" :selected="menu.selected.value === option.key" />
    </li>
  </template>
</template>
