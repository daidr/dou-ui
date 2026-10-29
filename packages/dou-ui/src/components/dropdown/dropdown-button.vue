<script setup lang="ts">
import { ChevronDownIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import DouButton from '../button/button.vue'
import { useLocale } from '../config-provider/use-config'
import DouFieldGroup from '../field-group/field-group.vue'
import Dropdown from './dropdown.vue'
import type { DropdownButtonProps, DropdownButtonSlots, DropdownValue } from './dropdown'

defineOptions({ name: 'DouDropdownButton' })

const props = withDefaults(defineProps<DropdownButtonProps>(), {
  variant: 'outline',
  disabled: false,
  loading: false,
  placement: 'bottom-end',
  trigger: 'click',
  hideOnSelect: true,
})
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  click: [event: MouseEvent]
  select: [value: DropdownValue | undefined]
}>()
const slots = defineSlots<DropdownButtonSlots>()

const ns = useNamespace('dropdown-button')
const { t } = useLocale()

const button = computed(() => ({
  variant: props.variant,
  tone: props.tone,
  size: props.size,
}))
</script>

<template>
  <DouFieldGroup :class="ns.b()">
    <DouButton
      v-bind="button"
      :disabled="disabled"
      :loading="loading"
      :class="ns.e('main')"
      @click="emit('click', $event)"
    >
      <template v-if="slots.leading" #leading><slot name="leading" /></template>
      <slot />
    </DouButton>
    <Dropdown
      v-model:open="open"
      :placement="placement"
      :trigger="trigger"
      :disabled="disabled"
      :hide-on-select="hideOnSelect"
      @select="emit('select', $event)"
    >
      <DouButton
        v-bind="button"
        :disabled="disabled"
        :class="ns.e('arrow')"
        :aria-label="t('dropdown.more')"
      >
        <ChevronDownIcon />
      </DouButton>
      <template #menu><slot name="menu" /></template>
    </Dropdown>
  </DouFieldGroup>
</template>
