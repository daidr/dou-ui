<script setup lang="ts" generic="T">
import type { HTMLAttributes } from 'vue'
import type { ForwardedAttributes } from '../../utils/install'
import { computed } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { SortableEmits, SortableProps, SortableSlots } from './sortable'
import { useSortable } from './use-sortable'

defineOptions({ name: 'DouSortable' })

const props = withDefaults(
  defineProps<
    SortableProps<T> &
      /* @vue-ignore */ ForwardedAttributes<
        HTMLAttributes,
        SortableProps<T>,
        keyof SortableEmits<T> & string
      >
  >(),
  {
    direction: 'vertical',
    handle: false,
    disabled: false,
    animation: true,
    tag: 'div',
    itemTag: 'div',
  },
)
const emit = defineEmits<SortableEmits<T>>()
const slots = defineSlots<SortableSlots<T>>()

const ns = useNamespace('sortable')
const { t } = useLocale()

function keyOf(item: T): PropertyKey {
  if (typeof props.itemKey === 'function') return props.itemKey(item)
  if (item === null || typeof item !== 'object') return item as PropertyKey
  return (item as Record<string, PropertyKey>)[props.itemKey ?? 'id']!
}

const items = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const sortable = useSortable<T>({
  items,
  key: keyOf,
  group: () => props.group,
  handle: () => props.handle,
  disabled: () => props.disabled,
  direction: () => props.direction,
  label: (item, index) =>
    props.itemLabel?.(item, index) ?? t('sortable.position', { n: index + 1 }),
  messages: () => ({
    item: t('sortable.item'),
    lifted: (label, position, total) => t('sortable.lifted', { label, position, total }),
    moved: (label, position, total) => t('sortable.moved', { label, position, total }),
    dropped: (label, position, total) => t('sortable.dropped', { label, position, total }),
    canceled: (label) => t('sortable.canceled', { label }),
  }),
  ghost: (el) => props.ghost?.(el) ?? (el.cloneNode(true) as HTMLElement),
  onSort: (event) => emit('sort', event),
  onAdd: (event) => emit('add', event),
  onRemove: (event) => emit('remove', event),
})
const { list, dragging } = sortable

function setContainer(ref: Element | ComponentPublicInstance | null) {
  const el = ref && '$el' in ref ? (ref.$el as Element) : ref
  sortable.container.value = el instanceof HTMLElement ? el : null
}

const classes = computed(() => [
  ns.b(),
  ns.m(props.direction),
  ns.is('disabled', props.disabled),
  ns.is('empty', !list.value.length),
])
</script>

<template>
  <TransitionGroup
    :ref="setContainer"
    :tag="tag"
    :name="animation ? 'dou-sortable' : undefined"
    :css="animation"
    :class="classes"
    v-bind="sortable.listAttrs.value"
  >
    <component
      :is="itemTag"
      v-for="(item, index) in list"
      :key="keyOf(item)"
      :class="[ns.e('item'), ns.is('handle', handle)]"
      :aria-description="handle || disabled ? undefined : t('sortable.hint')"
      v-bind="sortable.itemAttrs(item, index)"
    >
      <slot :item="item" :index="index" :dragging="dragging === keyOf(item)" />
    </component>
    <div v-if="!list.length && slots.empty" key="dou-sortable-empty" :class="ns.e('empty')">
      <slot name="empty" />
    </div>
  </TransitionGroup>
</template>
