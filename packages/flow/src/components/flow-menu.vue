<script setup lang="ts">
import { DouContextMenu, DouDropdownItem, DouDropdownRadioGroup, DouIcon } from 'dou-ui'
import { computed, defineComponent, h, nextTick, useTemplateRef, type PropType } from 'vue'
import type { FlowMenuItem } from '../core/menu'

const props = defineProps<{ items: FlowMenuItem[] }>()
const emit = defineEmits<{ select: [key: unknown] }>()
const open = defineModel<boolean>('open', { default: false })

// Shortcuts mean nothing without a keyboard.
const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** Every item marked or not: one choice, read as radio items. */
const choice = computed(
  () => props.items.length > 0 && props.items.every((item) => item.checked !== undefined),
)
const picked = computed(() => props.items.find((item) => item.checked)?.key)

// One item; `checked` is left to the radio group in a choice.
const Item = defineComponent({
  props: { item: { type: Object as PropType<FlowMenuItem>, required: true }, radio: Boolean },
  setup(itemProps) {
    return () => {
      const { item } = itemProps
      return h(
        DouDropdownItem,
        {
          value: item.key,
          disabled: item.disabled,
          tone: item.tone,
          divided: item.divided,
          checked: itemProps.radio ? undefined : item.checked,
          shortcut: coarse() ? undefined : item.shortcut,
        },
        {
          default: () => item.label,
          prefix: item.icon ? () => h(DouIcon, null, () => h(item.icon!)) : undefined,
        },
      )
    }
  },
})

const menu = useTemplateRef<InstanceType<typeof DouContextMenu>>('menu')

defineExpose({
  /**
   * `box` makes (x, y) the top left of a box the menu opens beside, e.g. the
   * button that opened it; `focusChecked` puts focus on the option in use,
   * for a menu opened from the keyboard.
   */
  open(
    x: number,
    y: number,
    {
      box,
      focusChecked = false,
    }: { box?: { width: number; height: number }; focusChecked?: boolean } = {},
  ) {
    menu.value?.open(x, y, box)
    if (!focusChecked) return
    // after the menu has focused itself
    void nextTick(() =>
      nextTick(() => {
        const panel = document.activeElement
        const item =
          panel?.querySelector<HTMLElement>('[aria-checked="true"]') ??
          panel?.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')
        item?.focus({ preventScroll: true })
      }),
    )
  },
  close: () => menu.value?.close(),
})
</script>

<template>
  <!-- The editor opens the menu itself; the empty anchor only gives it a place in the page. -->
  <DouContextMenu ref="menu" v-model:open="open" @select="emit('select', $event)">
    <span class="dou-flow-editor__menu-anchor" aria-hidden="true" />
    <template #menu>
      <DouDropdownRadioGroup v-if="choice" :model-value="picked">
        <Item v-for="item in items" :key="item.key" :item="item" radio />
      </DouDropdownRadioGroup>
      <template v-else>
        <Item v-for="item in items" :key="item.key" :item="item" />
      </template>
    </template>
  </DouContextMenu>
</template>
