<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useHotkey } from '../../composables/use-hotkey'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { DouDialog } from '../dialog'
import DouCommand from './command.vue'
import type { CommandDialogProps, CommandExpose, CommandItem, CommandSlots } from './command'

defineOptions({ name: 'DouCommandDialog' })

const props = withDefaults(defineProps<CommandDialogProps>(), {
  loop: true,
  maxHeight: 360,
  virtual: undefined,
  hotkey: 'mod+k',
  closeOnSelect: true,
  width: 560,
})
const open = defineModel<boolean>('open', { default: false })
const query = defineModel<string>('query', { default: '' })
const emit = defineEmits<{ select: [item: CommandItem] }>()
const slots = defineSlots<CommandSlots>()

const ns = useNamespace('command-dialog')
const { t } = useLocale()
const commandRef = useTemplateRef<CommandExpose>('command')

useHotkey(
  () => props.hotkey,
  () => (open.value = !open.value),
  { allowInInput: true },
)

// Each opening starts from an empty search.
watch(open, async (value) => {
  if (!value) return
  query.value = ''
  await nextTick()
  commandRef.value?.focus()
})

function onSelect(item: CommandItem) {
  emit('select', item)
  if (props.closeOnSelect) open.value = false
}

const commandProps = computed(() => ({
  items: props.items,
  placeholder: props.placeholder,
  emptyText: props.emptyText,
  filter: props.filter,
  loop: props.loop,
  maxHeight: props.maxHeight,
  virtual: props.virtual,
  itemSize: props.itemSize,
  ariaLabel: props.ariaLabel,
}))
</script>

<template>
  <DouDialog
    v-model:open="open"
    :class="ns.b()"
    :width="width"
    :closable="false"
    :aria-label="ariaLabel ?? placeholder ?? t('command.placeholder')"
  >
    <DouCommand ref="command" v-model:query="query" v-bind="commandProps" @select="onSelect">
      <template v-if="slots.item" #item="scope"><slot name="item" v-bind="scope" /></template>
      <template v-if="slots.prefix" #prefix><slot name="prefix" /></template>
      <template v-if="slots.empty" #empty><slot name="empty" /></template>
      <template v-if="slots.footer" #footer><slot name="footer" /></template>
    </DouCommand>
  </DouDialog>
</template>
