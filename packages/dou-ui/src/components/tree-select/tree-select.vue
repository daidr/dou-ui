<script setup lang="ts">
import { isComposing } from '../../utils/keyboard'
import { ChevronDownIcon, CloseIcon } from '@dou-ui/icons'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import type { HTMLAttributes } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import { DouTag } from '../tag'
import DouTree from '../tree/tree.vue'
import type { TreeExpose, TreeKey, TreeNodeData } from '../tree/tree'
import type {
  TreeSelectExpose,
  TreeSelectProps,
  TreeSelectSlots,
  TreeSelectValue,
} from './tree-select'
import { useTeleport } from '../../utils/teleport'

defineOptions({ name: 'DouTreeSelect', inheritAttrs: false })

const props = withDefaults(defineProps<TreeSelectProps>(), {
  multiple: false,
  checkStrictly: false,
  leafOnly: false,
  filterable: false,
  defaultExpandAll: false,
  disabled: false,
  invalid: false,
  clearable: false,
  placement: 'bottom-start',
  teleport: undefined,
})
const teleportTarget = useTeleport(() => props.teleport)
const model = defineModel<TreeSelectValue>()
const emit = defineEmits<{ change: [value: TreeSelectValue]; clear: [] }>()
const slots = defineSlots<TreeSelectSlots>()

const ns = useNamespace('tree-select')
const sns = useNamespace('select')
const { t } = useLocale()
const { formItem } = useFormItem()
if (!props.filterable) formItem?.markGroup()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

const id = `dou-tree-select-${useId()}`
const treeId = `${id}-tree`

// every node seen, so chosen keys keep their labels (lazily loaded ones too)
const nodes = new Map<TreeKey, { node: TreeNodeData; parent: TreeKey | null }>()
function index(list: TreeNodeData[], parent: TreeKey | null) {
  for (const node of list) {
    nodes.set(node.key, { node, parent })
    if (node.children) index(node.children, node.key)
  }
}
const version = ref(0)
watch(
  () => props.data,
  (data) => {
    index(data, null)
    version.value++
  },
  { immediate: true, deep: true },
)
const labelOf = (key: TreeKey) => {
  void version.value
  const node = nodes.get(key)?.node
  return node?.label ?? String(key)
}

const keys = computed<TreeKey[]>(() => {
  const value = model.value
  if (props.multiple) return Array.isArray(value) ? value : []
  return value === null || value === undefined || Array.isArray(value) ? [] : [value]
})
const hasValue = computed(() => keys.value.length > 0)

/**
 * The tags to show: with cascading checks a fully checked branch stands for
 * everything under it, so its descendants are left out.
 */
const tagKeys = computed(() => {
  void version.value
  if (!props.multiple || props.checkStrictly) return keys.value
  const set = new Set(keys.value)
  return keys.value.filter((key) => {
    for (let parent = nodes.get(key)?.parent; parent != null; parent = nodes.get(parent)?.parent) {
      if (set.has(parent)) return false
    }
    return true
  })
})

const open = ref(false)
const popup = usePopup({
  open,
  trigger: 'manual',
  closeOnOutside: true,
  disabled,
  placement: () => props.placement,
  offset: 4,
  sameWidth: true,
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle } = popup

const query = ref('')
const expanded = ref<TreeKey[]>()
const treeRef = useTemplateRef<TreeExpose>('tree')

function show() {
  if (disabled.value || open.value) return
  open.value = true
  // Reveal the chosen node the first time round.
  void nextTick(() => {
    const first = keys.value[0]
    if (first !== undefined) treeRef.value?.scrollTo(first)
  })
}
function hide() {
  open.value = false
  query.value = ''
}
watch(open, (value) => {
  if (!value) query.value = ''
})

function commit(value: TreeSelectValue) {
  model.value = value
  emit('change', value)
  formItem?.trigger('change')
}

const isLeaf = (node: TreeNodeData) =>
  node.isLeaf === true || (!props.load && !(node.children && node.children.length))

function onSelect(node: TreeNodeData) {
  if (props.multiple || node.disabled) return
  if (props.leafOnly && !isLeaf(node)) return
  nodes.set(node.key, { node, parent: nodes.get(node.key)?.parent ?? null })
  if (node.key !== model.value) commit(node.key)
  hide()
  focus()
}

function onChecked(value: TreeKey[] | undefined) {
  commit(value ?? [])
}

function remove(key: TreeKey) {
  if (disabled.value) return
  // Removing a branch tag also unchecks what it stands for.
  const drop = new Set([key])
  if (!props.checkStrictly) {
    for (const other of keys.value) {
      for (
        let parent = nodes.get(other)?.parent;
        parent != null;
        parent = nodes.get(parent)?.parent
      ) {
        if (parent === key) drop.add(other)
      }
    }
    // and the branches above it are no longer fully checked
    for (let parent = nodes.get(key)?.parent; parent != null; parent = nodes.get(parent)?.parent) {
      drop.add(parent)
    }
  }
  commit(keys.value.filter((item) => !drop.has(item)))
}

function clear() {
  commit(props.multiple ? [] : null)
  emit('clear')
  hide()
  focus()
}

const fieldRef = useTemplateRef<HTMLElement>('field')
const inputRef = useTemplateRef<HTMLInputElement>('input')
const combobox = () => (props.filterable ? inputRef.value : fieldRef.value)
function focus() {
  combobox()?.focus()
}

function focusTree() {
  void nextTick(() => treeRef.value?.focus())
}

function onKeydown(event: KeyboardEvent) {
  if (disabled.value || isComposing(event)) return
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      show()
      focusTree()
      return
    case 'Enter':
      event.preventDefault()
      if (open.value) focusTree()
      else show()
      return
    case ' ':
      if (props.filterable) return
      event.preventDefault()
      show()
      focusTree()
      return
    case 'Escape':
      if (!open.value) return
      event.stopPropagation()
      hide()
      return
    case 'Tab':
      hide()
      return
    case 'Backspace':
      if (props.multiple && props.filterable && !query.value && tagKeys.value.length) {
        remove(tagKeys.value.at(-1)!)
      }
  }
}

// Escape inside the tree closes the list and hands focus back to the field.
function onPanelKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  hide()
  focus()
}

function onFieldMousedown(event: MouseEvent) {
  if (disabled.value) return
  const target = event.target as HTMLElement
  if (target.closest('button')) return
  if (target !== inputRef.value) event.preventDefault()
  focus()
  if (open.value && target !== inputRef.value) hide()
  else show()
}

function onFocusout(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && (fieldRef.value?.contains(next) || panelRef.value?.contains(next))) {
    return
  }
  hide()
  formItem?.trigger('blur')
}

const comboboxAttrs = computed<HTMLAttributes>(() => ({
  role: 'combobox',
  'aria-haspopup': 'tree',
  'aria-expanded': open.value,
  'aria-controls': rendered.value ? treeId : undefined,
  'aria-disabled': disabled.value || undefined,
  'aria-invalid': invalid.value || undefined,
  'aria-required': formItem?.required.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
  'aria-label': props.ariaLabel,
}))

const singleLabel = computed(() =>
  !props.multiple && keys.value[0] !== undefined ? labelOf(keys.value[0]) : '',
)
const placeholderText = computed(() => props.placeholder ?? t('select.placeholder'))
const inputPlaceholder = computed(() => {
  if (props.multiple) return hasValue.value ? '' : placeholderText.value
  return singleLabel.value || placeholderText.value
})
const showClear = computed(() => props.clearable && !disabled.value && hasValue.value)

const classes = computed(() => [
  sns.b(),
  sns.m(size.value),
  ns.b(),
  sns.is('multiple', props.multiple),
  sns.is('filterable', props.filterable),
  sns.is('open', open.value),
  sns.is('disabled', disabled.value),
  sns.is('invalid', invalid.value),
  sns.is('selected', hasValue.value),
])

defineExpose<TreeSelectExpose>({ focus, blur: () => combobox()?.blur() })
</script>

<template>
  <OnlyChild ref="triggerRef">
    <div
      ref="field"
      :class="classes"
      v-bind="filterable ? $attrs : { ...$attrs, ...comboboxAttrs }"
      :id="filterable ? undefined : formItem?.inputId"
      :aria-labelledby="filterable ? undefined : formItem?.labelId"
      :tabindex="filterable || disabled ? undefined : 0"
      @mousedown="onFieldMousedown"
      @keydown="filterable ? undefined : onKeydown($event)"
      @focusout="onFocusout"
    >
      <span v-if="slots.prefix" :class="sns.e('prefix')"><slot name="prefix" /></span>
      <div :class="sns.e('selection')">
        <template v-if="multiple">
          <DouTag
            v-for="key in tagKeys"
            :key="String(key)"
            :size="size"
            :closable="!disabled"
            :class="sns.e('tag')"
            @close="remove(key)"
          >
            {{ labelOf(key) }}
          </DouTag>
        </template>
        <input
          v-if="filterable"
          ref="input"
          v-model="query"
          v-bind="comboboxAttrs"
          :id="formItem?.inputId"
          :class="sns.e('input')"
          type="text"
          autocomplete="off"
          :placeholder="inputPlaceholder"
          :disabled="disabled"
          @input="show"
          @keydown="onKeydown"
        />
        <span v-else-if="!multiple && hasValue" :class="sns.e('value')">{{ singleLabel }}</span>
        <span v-else-if="!hasValue" :class="sns.e('placeholder')">{{ placeholderText }}</span>
      </div>
      <button
        v-if="showClear"
        type="button"
        tabindex="-1"
        :class="sns.e('clear')"
        :aria-label="t('select.clear')"
        @mousedown.prevent
        @click="clear"
      >
        <CloseIcon />
      </button>
      <ChevronDownIcon :class="sns.e('arrow')" />
    </div>
  </OnlyChild>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        ref="panelRef"
        :class="[sns.e('menu'), ns.e('menu'), 'dou-floating']"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        @keydown="onPanelKeydown"
        @focusout="onFocusout"
      >
        <DouTree
          :id="treeId"
          ref="tree"
          v-model:expanded="expanded"
          :data="data"
          :selected="multiple ? null : (keys[0] ?? null)"
          :checked="multiple ? keys : undefined"
          :selectable="!multiple"
          :checkable="multiple"
          :check-strictly="checkStrictly"
          :default-expand-all="defaultExpandAll"
          :expand-on-click="multiple || leafOnly"
          :load="load"
          :filter="filterable ? query : undefined"
          :height="height"
          :max-height="height === undefined ? 'var(--dou-tree-select-list-max-height)' : undefined"
          :aria-label="ariaLabel"
          :aria-labelledby="formItem?.labelId"
          size="sm"
          @select="onSelect"
          @update:checked="onChecked"
        >
          <template v-if="slots.node" #node="{ node, selected, checked }">
            <slot name="node" :node="node" :selected="selected" :checked="checked" />
          </template>
          <template #empty>
            <slot name="empty">{{ t('select.empty') }}</slot>
          </template>
        </DouTree>
      </div>
    </Transition>
  </Teleport>
</template>
