<script setup lang="ts">
import { ChevronDownIcon } from '@dou-ui/icons'
import { computed, inject } from 'vue'
import type { FunctionalComponent, VNode } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { menuKey } from './menu'
import type { MenuItemOption } from './menu'

defineOptions({ name: 'DouMenuItem' })

const props = withDefaults(
  defineProps<{
    item: MenuItemOption
    level?: number
    /**
     * `leaf` is chosen on click, `submenu` opens in place, `trigger` opens
     * a popup that is wired up by the surrounding dropdown.
     */
    kind?: 'leaf' | 'submenu' | 'trigger'
    /** Show the icon alone; the label becomes the accessible name. */
    iconOnly?: boolean
  }>(),
  { level: 0, kind: 'leaf', iconOnly: false },
)

const ns = useNamespace('menu')
const menu = inject(menuKey)!

const selected = computed(() => props.kind === 'leaf' && menu.selected.value === props.item.key)
const active = computed(() => props.kind !== 'leaf' && menu.holdsSelected(props.item))
const expanded = computed(() => props.kind === 'submenu' && menu.isExpanded(props.item.key))
const tag = computed(() => (props.kind === 'leaf' && props.item.href ? 'a' : 'button'))

const Label: FunctionalComponent = () =>
  (menu.labelSlot()?.({ item: props.item, selected: selected.value }) as VNode[] | undefined) ??
  props.item.label

function onClick(event: MouseEvent) {
  if (props.item.disabled) {
    event.preventDefault()
    return
  }
  if (props.kind === 'leaf') menu.choose(props.item)
  else if (props.kind === 'submenu') menu.toggle(props.item)
}
</script>

<template>
  <component
    :is="tag"
    :type="tag === 'button' ? 'button' : undefined"
    :href="tag === 'a' && !item.disabled ? item.href : undefined"
    :class="[
      ns.e('item'),
      ns.is('selected', selected),
      ns.is('active', active),
      ns.is('disabled', !!item.disabled),
    ]"
    :style="level ? { '--dou-menu-level': level } : undefined"
    :aria-current="selected ? 'page' : undefined"
    :aria-expanded="kind === 'submenu' ? expanded : undefined"
    :aria-controls="kind === 'submenu' ? menu.subId(item.key) : undefined"
    :aria-disabled="item.disabled || undefined"
    :aria-label="iconOnly ? item.label : undefined"
    data-dou-menu-item=""
    @click="onClick"
    @contextmenu="menu.contextmenu(item, $event)"
  >
    <component :is="item.icon" v-if="item.icon" :class="ns.e('icon')" aria-hidden="true" />
    <span v-else-if="iconOnly" :class="ns.e('initial')" aria-hidden="true">
      {{ item.label.slice(0, 1) }}
    </span>
    <span v-if="!iconOnly" :class="ns.e('label')"><Label /></span>
    <ChevronDownIcon
      v-if="kind !== 'leaf' && !iconOnly"
      :class="[ns.e('arrow'), ns.is('open', expanded)]"
    />
  </component>
</template>
