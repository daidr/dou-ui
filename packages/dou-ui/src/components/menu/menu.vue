<script setup lang="ts">
import { computed, provide, ref, useId, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouTooltip } from '../tooltip'
import { isDivider, isGroup, isItem, menuKey, pathTo } from './menu'
import type { MenuItemOption, MenuKey, MenuOption, MenuProps, MenuSlots } from './menu'
import MenuItem from './menu-item.vue'
import MenuList from './menu-list.vue'
import MenuPopup from './menu-popup.vue'

defineOptions({ name: 'DouMenu' })

const props = withDefaults(defineProps<MenuProps>(), {
  items: () => [],
  mode: 'vertical',
  collapsed: false,
  accordion: false,
})
const model = defineModel<MenuKey>()
const expandedModel = defineModel<MenuKey[]>('expanded')
const emit = defineEmits<{ select: [key: MenuKey, item: MenuItemOption] }>()
const slots = defineSlots<MenuSlots>()

const ns = useNamespace('menu')
const id = useId()

// Popups replace the inline submenus when there is no room to unfold them.
const popups = computed(() => props.mode === 'horizontal' || props.collapsed)

const initial = () =>
  expandedModel.value ?? (model.value === undefined ? [] : (pathTo(props.items, model.value) ?? []))
const expanded = ref<MenuKey[]>(initial())
watch(expandedModel, (value) => {
  if (value) expanded.value = value
})
function setExpanded(keys: MenuKey[]) {
  expanded.value = keys
  expandedModel.value = keys
}

const holdsSelected = (item: MenuItemOption) =>
  model.value !== undefined && !!pathTo(props.items, model.value)?.includes(item.key)

provide(menuKey, {
  selected: computed(() => model.value),
  isExpanded: (key) => expanded.value.includes(key),
  holdsSelected,
  toggle(item) {
    if (expanded.value.includes(item.key)) {
      setExpanded(expanded.value.filter((key) => key !== item.key))
      return
    }
    // In an accordion only the chain down to this submenu stays open.
    const keys = props.accordion
      ? [...(pathTo(props.items, item.key) ?? []), item.key]
      : [...expanded.value, item.key]
    setExpanded(keys)
  },
  choose(item, fromPopup = false) {
    if (item.disabled) return
    model.value = item.key
    emit('select', item.key, item)
    if (fromPopup && item.href) window.location.assign(item.href)
  },
  labelSlot: () => slots.label,
  subId: (key) => `${id}-sub-${String(key).replace(/\s+/g, '-')}`,
})

/** The top row of a horizontal or collapsed menu: groups only add a divider. */
const topLevel = computed(() => {
  const entries: MenuOption[] = []
  const add = (options: MenuOption[]) => {
    for (const option of options) {
      if (isGroup(option)) {
        if (entries.length) entries.push({ type: 'divider' })
        add(option.children)
      } else entries.push(option)
    }
  }
  add(props.items)
  return entries
})

// Arrow keys move between the visible items of a vertical menu.
function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return
  const root = event.currentTarget as HTMLElement
  const target = event.target as HTMLElement
  if (!target.matches('[data-dou-menu-item]') || !root.contains(target)) return
  const vertical = props.mode === 'vertical'
  const next = vertical ? 'ArrowDown' : 'ArrowRight'
  const prev = vertical ? 'ArrowUp' : 'ArrowLeft'
  // skip the items of closed submenus, which are hidden by `v-show`
  const visible = (item: HTMLElement) => {
    for (let el = item.parentElement; el && el !== root; el = el.parentElement)
      if (el.style.display === 'none') return false
    return true
  }
  const items = [...root.querySelectorAll<HTMLElement>('[data-dou-menu-item]')].filter(visible)
  const index = items.indexOf(target)
  let focus: HTMLElement | undefined
  switch (event.key) {
    case next:
      focus = items[(index + 1) % items.length]
      break
    case prev:
      focus = items[(index - 1 + items.length) % items.length]
      break
    case 'Home':
      focus = items[0]
      break
    case 'End':
      focus = items.at(-1)
      break
    case 'ArrowRight':
    case 'ArrowLeft': {
      if (!vertical || popups.value) return
      const open = target.getAttribute('aria-expanded')
      if (event.key === 'ArrowRight' && open === 'false') target.click()
      else if (event.key === 'ArrowLeft' && open === 'true') target.click()
      else if (event.key === 'ArrowLeft') {
        // up to the submenu that holds this item
        const list = target.closest('ul')
        focus =
          list?.parentElement?.querySelector<HTMLElement>(':scope > [data-dou-menu-item]') ??
          undefined
      }
      if (!focus) {
        event.preventDefault()
        return
      }
      break
    }
    default:
      return
  }
  event.preventDefault()
  focus?.focus()
}
</script>

<template>
  <nav
    :class="[ns.b(), ns.m(mode), ns.is('collapsed', collapsed && mode === 'vertical')]"
    data-dou-menu-root=""
    @keydown="onKeydown"
  >
    <ul :class="ns.e('list')">
      <MenuList v-if="!popups" :options="items" :level="0" />
      <template v-else>
        <template v-for="(option, index) in topLevel" :key="isItem(option) ? option.key : index">
          <li v-if="isDivider(option)" role="separator" :class="ns.e('divider')" />
          <li v-else-if="isItem(option)" :class="ns.e('entry')">
            <MenuPopup
              v-if="option.children?.length"
              :item="option"
              :placement="mode === 'horizontal' ? 'bottom-start' : 'right-start'"
              :icon-only="collapsed && mode === 'vertical'"
            />
            <DouTooltip
              v-else-if="collapsed && mode === 'vertical'"
              :content="option.label"
              placement="right"
            >
              <MenuItem :item="option" icon-only />
            </DouTooltip>
            <MenuItem v-else :item="option" />
          </li>
        </template>
      </template>
    </ul>
  </nav>
</template>
