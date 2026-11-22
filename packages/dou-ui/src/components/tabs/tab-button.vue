<script setup lang="ts">
import { h } from 'vue'
import { CloseIcon } from '@dou-ui/icons'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { DouTooltip } from '../tooltip'
import type { FunctionalComponent, VNode } from 'vue'
import type { TabPanelEntry } from './tabs'

defineOptions({ name: 'DouTabButton' })

const props = defineProps<{
  entry: TabPanelEntry
  tabId: string
  panelId: string
  labelText: string
  selected: boolean
  closable: boolean
  iconAlone: boolean
  draggable: boolean
  dragging: boolean
  tipPlacement: 'top' | 'right' | 'left'
  keyShortcuts?: string
  setEl: (el: unknown) => void
}>()

const emit = defineEmits<{
  click: []
  pointerdown: [event: PointerEvent]
  keydown: [event: KeyboardEvent]
  remove: []
}>()

const ns = useNamespace('tabs')
const { t } = useLocale()
const onButtonRef = (el: unknown) => props.setEl(el)

/** The label slot of a panel, rendered inside its tab. */
const TabLabel: FunctionalComponent = () =>
  (props.entry.slots.label?.({ selected: props.selected }) as VNode[] | undefined) ??
  props.labelText

const TabTip: FunctionalComponent = (_, { slots: tip }) =>
  props.iconAlone
    ? h(DouTooltip, { content: props.labelText, placement: props.tipPlacement }, tip)
    : tip.default?.()
</script>

<template>
  <TabTip>
    <button
      :id="tabId"
      :ref="onButtonRef"
      type="button"
      role="tab"
      :class="[
        ns.e('tab'),
        ns.is('selected', selected),
        ns.is('disabled', !!entry.props.disabled),
        ns.is('closable', closable),
        ns.is('icon-alone', iconAlone),
        ns.is('pinned', !!entry.props.pinned),
        ns.is('draggable', draggable),
        ns.is('dragging', dragging),
      ]"
      :aria-selected="selected"
      :aria-controls="panelId"
      :aria-label="iconAlone ? labelText : undefined"
      :aria-disabled="entry.props.disabled || undefined"
      :tabindex="selected ? 0 : -1"
      :aria-keyshortcuts="keyShortcuts"
      @click="emit('click')"
      @pointerdown="emit('pointerdown', $event)"
      @keydown="emit('keydown', $event)"
    >
      <component
        :is="entry.props.icon"
        v-if="entry.props.icon"
        :class="ns.e('icon')"
        aria-hidden="true"
      />
      <span v-if="!iconAlone" :class="ns.e('label')">
        <TabLabel />
      </span>
      <!-- not a button of its own: a tab cannot hold one; `Delete` closes it from the keyboard.
       An icon alone already has the label's tooltip, so the close button goes without. -->
      <DouTooltip
        v-if="closable"
        :content="t('tabs.close')"
        shortcut="delete"
        :disabled="iconAlone"
      >
        <span :class="ns.e('close')" aria-hidden="true" @click.stop="emit('remove')">
          <CloseIcon />
        </span>
      </DouTooltip>
    </button>
  </TabTip>
</template>
