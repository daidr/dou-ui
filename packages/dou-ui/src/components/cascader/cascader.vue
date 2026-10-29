<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, CloseIcon } from '@dou-ui/icons'
import { computed, nextTick, reactive, ref, useId, useTemplateRef, watch } from 'vue'
import type { HTMLAttributes } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { useLocale } from '../config-provider/use-config'
import { useFormDisabled, useFormItem, useFormSize } from '../form/use-form-item'
import DouCheckbox from '../checkbox/checkbox.vue'
import { DouSpinner } from '../spinner'
import { DouTag } from '../tag'
import type {
  CascaderExpose,
  CascaderOption,
  CascaderProps,
  CascaderSlots,
  CascaderValue,
} from './cascader'
import { useTeleport } from '../../utils/teleport'

defineOptions({ name: 'DouCascader', inheritAttrs: false })

const props = withDefaults(defineProps<CascaderProps>(), {
  options: () => [],
  changeOnSelect: false,
  expandTrigger: 'click',
  filterable: false,
  separator: ' / ',
  showLastOnly: false,
  multiple: false,
  checkStrictly: false,
  disabled: false,
  invalid: false,
  clearable: false,
  placement: 'bottom-start',
  teleport: undefined,
})
const teleportTarget = useTeleport(() => props.teleport)
const model = defineModel<CascaderValue[] | CascaderValue[][] | null>()
const emit = defineEmits<{
  change: [
    value: CascaderValue[] | CascaderValue[][] | null,
    path: CascaderOption[] | CascaderOption[][],
  ]
}>()
const slots = defineSlots<CascaderSlots>()

const ns = useNamespace('cascader')
const { t } = useLocale()
const { formItem } = useFormItem()
if (!props.filterable) formItem?.markGroup()
const size = useFormSize(() => props.size)
const disabled = useFormDisabled(() => props.disabled)
const invalid = computed(() => props.invalid || !!formItem?.invalid.value)

const id = `dou-cascader-${useId()}`
const listboxId = (level: number) => `${id}-list-${level}`
const keyOf = (path: CascaderValue[]) => path.map(String).join('\u0000')
const optionId = (path: CascaderValue[]) =>
  `${id}-option-${path.map((value) => String(value).replace(/[^\w-]/g, '_')).join('-')}`
const labelOf = (option: CascaderOption) => option.label ?? String(option.value)

/* the tree, with the branches loaded so far */

const loaded = reactive(new Map<string, CascaderOption[]>())
const loading = reactive(new Set<string>())

const childrenOf = (option: CascaderOption, path: CascaderValue[]) =>
  option.children ?? loaded.get(keyOf(path))
const isLeaf = (option: CascaderOption, path: CascaderValue[]) => {
  const children = childrenOf(option, path)
  if (children) return children.length === 0
  return !props.load || !!option.leaf
}

/** The options along a path of values, as far as they are known. */
function resolve(values: CascaderValue[]): CascaderOption[] {
  const found: CascaderOption[] = []
  let level: CascaderOption[] | undefined = props.options
  for (const [index, value] of values.entries()) {
    const option: CascaderOption | undefined = level?.find((item) => item.value === value)
    if (!option) break
    found.push(option)
    level = childrenOf(option, values.slice(0, index + 1))
  }
  return found
}

async function ensure(option: CascaderOption, path: CascaderValue[]) {
  const key = keyOf(path)
  if (!props.load || option.children || option.leaf || loaded.has(key) || loading.has(key)) return
  loading.add(key)
  try {
    loaded.set(key, await props.load(option, resolve(path)))
  } catch {
    // leave it unloaded so opening it again retries
  } finally {
    loading.delete(key)
  }
}

/* the open columns: the chain of options under the pointer or cursor */

const expanded = ref<CascaderValue[]>([])
const columns = computed(() => {
  const list: { options: CascaderOption[]; path: CascaderValue[] }[] = [
    { options: props.options, path: [] },
  ]
  const chain = resolve(expanded.value)
  for (const [index, option] of chain.entries()) {
    const path = expanded.value.slice(0, index + 1)
    const children = childrenOf(option, path)
    if (children?.length || loading.has(keyOf(path))) list.push({ options: children ?? [], path })
  }
  return list
})

// The highlighted option, as a path of values. Focus stays in the field.
const active = ref<CascaderValue[]>([])

/** The single path, or nothing with `multiple`. */
const single = computed<CascaderValue[]>(() =>
  props.multiple || !model.value ? [] : (model.value as CascaderValue[]),
)
const selectedPath = computed(() => resolve(single.value))
const isOnSelected = (path: CascaderValue[]) => {
  if (props.multiple) return checkState(path) === 'on'
  const value = single.value
  return (
    value.length > 0 &&
    path.length <= value.length &&
    path.every((item, index) => value[index] === item)
  )
}

/* checking, with `multiple` */

const checkedPaths = computed<CascaderValue[][]>(() =>
  props.multiple && Array.isArray(model.value)
    ? (model.value as unknown[]).filter((item): item is CascaderValue[] => Array.isArray(item))
    : [],
)
const checkedKeys = computed(() => new Set(checkedPaths.value.map(keyOf)))
const isUnder = (path: CascaderValue[], parent: CascaderValue[]) =>
  path.length >= parent.length && parent.every((value, index) => path[index] === value)

/** The paths a check of this option stands for: its leaves as far as they are known. */
function leavesUnder(option: CascaderOption, path: CascaderValue[]): CascaderValue[][] {
  const children = childrenOf(option, path)
  if (isLeaf(option, path) || !children) return [path]
  return children
    .filter((child) => !child.disabled)
    .flatMap((child) => leavesUnder(child, [...path, child.value]))
}

function checkState(path: CascaderValue[]): 'on' | 'off' | 'some' {
  if (checkedKeys.value.has(keyOf(path))) return 'on'
  if (props.checkStrictly) return 'off'
  const option = resolve(path).at(-1)
  if (!option || resolve(path).length !== path.length) return 'off'
  const leaves = leavesUnder(option, path)
  const count = leaves.filter((leaf) => checkedKeys.value.has(keyOf(leaf))).length
  if (count && count === leaves.length && !isLeaf(option, path)) return 'on'
  return checkedPaths.value.some((item) => item.length > path.length && isUnder(item, path))
    ? 'some'
    : 'off'
}

async function toggleCheck(option: CascaderOption, path: CascaderValue[]) {
  if (option.disabled) return
  const on = checkState(path) === 'on'
  if (props.checkStrictly) {
    commit(
      on
        ? checkedPaths.value.filter((item) => keyOf(item) !== keyOf(path))
        : [...checkedPaths.value, path],
    )
    return
  }
  await ensure(option, path)
  const rest = checkedPaths.value.filter((item) => !isUnder(item, path))
  commit(on ? rest : [...rest, ...leavesUnder(option, path)])
}

function removePath(path: CascaderValue[]) {
  if (disabled.value) return
  commit(checkedPaths.value.filter((item) => keyOf(item) !== keyOf(path)))
}

/* search */

const query = ref('')
interface Match {
  path: CascaderOption[]
  values: CascaderValue[]
  label: string
}
const matches = computed<Match[]>(() => {
  const text = query.value.trim().toLowerCase()
  if (!props.filterable || !text) return []
  const result: Match[] = []
  const walk = (options: CascaderOption[], trail: CascaderOption[], values: CascaderValue[]) => {
    for (const option of options) {
      if (option.disabled) continue
      const path = [...trail, option]
      const keys = [...values, option.value]
      const label = path.map(labelOf).join(props.separator)
      const leaf = isLeaf(option, keys)
      const pickable = leaf || props.changeOnSelect || (props.multiple && props.checkStrictly)
      if (pickable && label.toLowerCase().includes(text)) result.push({ path, values: keys, label })
      const children = childrenOf(option, keys)
      if (children) walk(children, path, keys)
    }
  }
  walk(props.options, [], [])
  return result
})
const searching = computed(() => props.filterable && !!query.value.trim())
const activeMatch = ref(-1)
watch(matches, (list) => (activeMatch.value = list.length ? 0 : -1))

/* the popup */

const open = ref(false)
const popup = usePopup({
  open,
  trigger: 'manual',
  closeOnOutside: true,
  disabled,
  placement: () => props.placement,
  offset: 4,
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle } = popup

function show() {
  if (disabled.value || open.value) return
  open.value = true
  const chosen = props.multiple ? (checkedPaths.value[0] ?? []) : single.value
  expanded.value = chosen.slice(0, -1)
  active.value = chosen.length ? [...chosen] : firstEnabled([])
}
function hide() {
  open.value = false
  query.value = ''
}
watch(open, (value) => {
  if (!value) query.value = ''
})

watch(active, async (path) => {
  await nextTick()
  panelRef.value?.querySelector(`#${CSS.escape(optionId(path))}`)?.scrollIntoView?.({
    block: 'nearest',
  })
})

function optionsAt(parent: CascaderValue[]) {
  if (!parent.length) return props.options
  const chain = resolve(parent)
  const last = chain.at(-1)
  return chain.length === parent.length && last ? (childrenOf(last, parent) ?? []) : []
}
function firstEnabled(parent: CascaderValue[]) {
  const option = optionsAt(parent).find((item) => !item.disabled)
  return option ? [...parent, option.value] : []
}

function commit(values: CascaderValue[] | CascaderValue[][] | null) {
  model.value = values
  if (props.multiple) {
    const list = (values ?? []) as CascaderValue[][]
    emit('change', values, list.map(resolve))
  } else emit('change', values, values ? resolve(values as CascaderValue[]) : [])
  formItem?.trigger('change')
}

/** Open an option's column; `choose` also picks it when that is allowed. */
async function activate(option: CascaderOption, path: CascaderValue[], choose: boolean) {
  if (option.disabled) return
  active.value = path
  const parent = path.slice(0, -1)
  expanded.value = path
  await ensure(option, path)
  if (isLeaf(option, path)) {
    expanded.value = parent
    if (choose) {
      commit(path)
      hide()
      focus()
    }
    return
  }
  if (choose && props.changeOnSelect) commit(path)
}

function onOptionClick(option: CascaderOption, path: CascaderValue[]) {
  if (props.multiple && isLeaf(option, path)) {
    active.value = path
    expanded.value = path.slice(0, -1)
    void toggleCheck(option, path)
  } else void activate(option, path, !props.multiple)
}
function onOptionHover(option: CascaderOption, path: CascaderValue[]) {
  if (option.disabled) return
  active.value = path
  if (props.expandTrigger === 'hover' && !isLeaf(option, path)) void activate(option, path, false)
}

function chooseMatch(match: Match | undefined) {
  if (!match) return
  if (props.multiple) return void toggleCheck(match.path.at(-1)!, match.values)
  commit(match.values)
  hide()
  focus()
}

function clear() {
  commit(props.multiple ? [] : null)
  hide()
  focus()
}

const fieldRef = useTemplateRef<HTMLElement>('field')
const inputRef = useTemplateRef<HTMLInputElement>('input')
const combobox = () => (props.filterable ? inputRef.value : fieldRef.value)
function focus() {
  combobox()?.focus()
}

function moveWithin(step: 1 | -1 | 'first' | 'last') {
  const parent = active.value.slice(0, -1)
  const list = optionsAt(parent).filter((option) => !option.disabled)
  if (!list.length) return
  const at = list.findIndex((option) => option.value === active.value.at(-1))
  const index =
    step === 'first'
      ? 0
      : step === 'last'
        ? list.length - 1
        : (at + step + list.length) % list.length
  const path = [...parent, list[index]!.value]
  active.value = path
  // keep the next column in step with the cursor
  expanded.value = parent
}

async function enter(choose: boolean) {
  const chain = resolve(active.value)
  const option = chain.at(-1)
  if (!option || chain.length !== active.value.length) return
  const path = [...active.value]
  await activate(option, path, choose)
  if (!isLeaf(option, path) && !choose) {
    const next = firstEnabled(path)
    if (next.length) active.value = next
  }
}

function onKeydown(event: KeyboardEvent) {
  if (disabled.value) return
  if (searching.value) {
    const count = matches.value.length
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault()
        if (count)
          activeMatch.value =
            (activeMatch.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
        return
      case 'Enter':
        event.preventDefault()
        chooseMatch(matches.value[activeMatch.value])
        return
      case 'Tab':
        hide()
    }
    return
  }
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault()
      if (!open.value) show()
      else moveWithin(event.key === 'ArrowDown' ? 1 : -1)
      return
    case 'Home':
    case 'End':
      if (!open.value || props.filterable) return
      event.preventDefault()
      moveWithin(event.key === 'Home' ? 'first' : 'last')
      return
    case 'ArrowRight':
      if (!open.value) return
      event.preventDefault()
      void enter(false)
      return
    case 'ArrowLeft':
      if (!open.value || active.value.length < 2) return
      event.preventDefault()
      active.value = active.value.slice(0, -1)
      expanded.value = active.value.slice(0, -1)
      return
    case 'Enter':
    case ' ':
      if (event.key === ' ' && props.filterable) return
      event.preventDefault()
      if (!open.value) show()
      else if (props.multiple) {
        const option = resolve(active.value).at(-1)
        if (option && resolve(active.value).length === active.value.length)
          void toggleCheck(option, [...active.value])
      } else void enter(true)
      return
    case 'Backspace':
      if (props.multiple && props.filterable && !query.value && checkedPaths.value.length)
        removePath(checkedPaths.value.at(-1)!)
      return
    case 'Tab':
      hide()
  }
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

function onBlur(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && (fieldRef.value?.contains(next) || panelRef.value?.contains(next))) {
    return
  }
  hide()
  formItem?.trigger('blur')
}

const pathLabel = (path: CascaderOption[]) =>
  props.showLastOnly ? labelOf(path.at(-1)!) : path.map(labelOf).join(props.separator)
const tags = computed(() =>
  checkedPaths.value.map((values) => {
    const path = resolve(values)
    return {
      values,
      label:
        path.length === values.length ? pathLabel(path) : values.map(String).join(props.separator),
    }
  }),
)
const shownTags = computed(() =>
  props.maxTagCount === undefined
    ? tags.value
    : tags.value.slice(0, Math.max(0, props.maxTagCount)),
)
const hiddenTags = computed(() => tags.value.slice(shownTags.value.length))

const display = computed(() => {
  const path = selectedPath.value
  if (!path.length) return ''
  return props.showLastOnly ? labelOf(path.at(-1)!) : path.map(labelOf).join(props.separator)
})
const placeholderText = computed(() => props.placeholder ?? t('cascader.placeholder'))

const activeDescendant = computed(() => {
  if (!open.value) return undefined
  if (searching.value)
    return activeMatch.value >= 0 ? `${id}-match-${activeMatch.value}` : undefined
  return active.value.length ? optionId(active.value) : undefined
})

const comboboxAttrs = computed<HTMLAttributes>(() => ({
  role: 'combobox',
  'aria-haspopup': 'listbox',
  'aria-expanded': open.value,
  'aria-controls': rendered.value
    ? searching.value
      ? `${id}-matches`
      : listboxId(Math.max(0, active.value.length - 1))
    : undefined,
  'aria-activedescendant': activeDescendant.value,
  'aria-invalid': invalid.value || undefined,
  'aria-required': formItem?.required.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
}))

const showClear = computed(() => props.clearable && !disabled.value && !!model.value?.length)
const inputPlaceholder = computed(() => {
  if (props.multiple) return tags.value.length ? '' : placeholderText.value
  return display.value || placeholderText.value
})

defineExpose<CascaderExpose>({ focus, blur: () => combobox()?.blur() })
</script>

<template>
  <OnlyChild ref="triggerRef">
    <div
      ref="field"
      v-bind="{ ...$attrs, ...(filterable ? {} : comboboxAttrs) }"
      :class="[
        ns.b(),
        'dou-picker',
        `dou-picker--${size}`,
        ns.is('open', open),
        ns.is('multiple', multiple),
        ns.is('has-tags', tags.length > 0),
        ns.is('disabled', disabled),
        ns.is('invalid', invalid),
      ]"
      :id="filterable ? undefined : formItem?.inputId"
      :aria-labelledby="filterable ? undefined : formItem?.labelId"
      :tabindex="filterable || disabled ? undefined : 0"
      @mousedown="onFieldMousedown"
      @keydown="filterable ? undefined : onKeydown($event)"
      @focusout="onBlur"
    >
      <div v-if="multiple" :class="ns.e('tags')">
        <DouTag
          v-for="tag in shownTags"
          :key="keyOf(tag.values)"
          :size="size"
          :closable="!disabled"
          @close="removePath(tag.values)"
        >
          {{ tag.label }}
        </DouTag>
        <DouTag
          v-if="hiddenTags.length"
          :size="size"
          :class="ns.e('tag-more')"
          :title="hiddenTags.map((tag) => tag.label).join('、')"
        >
          +{{ hiddenTags.length }}
        </DouTag>
        <input
          v-if="filterable"
          ref="input"
          v-model="query"
          v-bind="comboboxAttrs"
          :id="formItem?.inputId"
          class="dou-picker__input"
          :class="ns.e('input')"
          type="text"
          autocomplete="off"
          aria-autocomplete="list"
          :placeholder="inputPlaceholder"
          :disabled="disabled"
          @input="show"
          @keydown="onKeydown"
        />
        <span v-else-if="!tags.length" class="dou-picker__placeholder">{{ placeholderText }}</span>
      </div>
      <input
        v-else-if="filterable"
        ref="input"
        v-model="query"
        v-bind="comboboxAttrs"
        :id="formItem?.inputId"
        class="dou-picker__input"
        type="text"
        autocomplete="off"
        aria-autocomplete="list"
        :placeholder="display || placeholderText"
        :disabled="disabled"
        :class="ns.is('has-value', !!display)"
        @input="show"
        @keydown="onKeydown"
      />
      <span v-else-if="display" class="dou-picker__value">{{ display }}</span>
      <span v-else class="dou-picker__placeholder">{{ placeholderText }}</span>
      <button
        v-if="showClear"
        type="button"
        tabindex="-1"
        class="dou-picker__clear"
        :aria-label="t('cascader.clear')"
        @mousedown.prevent
        @click="clear"
      >
        <CloseIcon />
      </button>
      <ChevronDownIcon class="dou-picker__arrow" />
    </div>
  </OnlyChild>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        ref="panelRef"
        :class="[ns.e('panel'), 'dou-picker-panel', 'dou-floating']"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        @mousedown.prevent
      >
        <ul
          v-if="searching"
          :id="`${id}-matches`"
          role="listbox"
          :class="[ns.e('column'), ns.e('matches')]"
        >
          <li
            v-for="(match, index) in matches"
            :id="`${id}-match-${index}`"
            :key="keyOf(match.values)"
            role="option"
            :aria-selected="multiple ? checkState(match.values) === 'on' : index === activeMatch"
            :class="[ns.e('option'), ns.is('active', index === activeMatch)]"
            @click="chooseMatch(match)"
            @mousemove="activeMatch = index"
          >
            <DouCheckbox
              v-if="multiple"
              :model-value="checkState(match.values) === 'on'"
              size="sm"
              tabindex="-1"
              aria-hidden="true"
              :class="ns.e('checkbox')"
              @click.stop
              @update:model-value="chooseMatch(match)"
            />
            <span :class="ns.e('label')">{{ match.label }}</span>
          </li>
          <li v-if="!matches.length" role="presentation" :class="ns.e('empty')">
            <slot name="empty">{{ t('cascader.empty') }}</slot>
          </li>
        </ul>
        <div v-else :class="ns.e('columns')">
          <ul
            v-for="(column, level) in columns"
            :id="listboxId(level)"
            :key="keyOf(column.path)"
            role="listbox"
            :class="ns.e('column')"
            :aria-multiselectable="multiple || undefined"
            :aria-busy="loading.has(keyOf(column.path)) || undefined"
          >
            <li
              v-for="option in column.options"
              :id="optionId([...column.path, option.value])"
              :key="String(option.value)"
              role="option"
              :aria-selected="isOnSelected([...column.path, option.value])"
              :aria-disabled="option.disabled || undefined"
              :aria-expanded="
                isLeaf(option, [...column.path, option.value])
                  ? undefined
                  : expanded[level] === option.value
              "
              :class="[
                ns.e('option'),
                ns.is('active', keyOf(active) === keyOf([...column.path, option.value])),
                ns.is('expanded', expanded[level] === option.value),
                ns.is('selected', isOnSelected([...column.path, option.value])),
                ns.is('disabled', !!option.disabled),
              ]"
              @click="onOptionClick(option, [...column.path, option.value])"
              @mouseenter="onOptionHover(option, [...column.path, option.value])"
            >
              <DouCheckbox
                v-if="multiple"
                :model-value="checkState([...column.path, option.value]) === 'on'"
                :indeterminate="checkState([...column.path, option.value]) === 'some'"
                :disabled="!!option.disabled"
                size="sm"
                tabindex="-1"
                aria-hidden="true"
                :class="ns.e('checkbox')"
                @click.stop
                @update:model-value="toggleCheck(option, [...column.path, option.value])"
              />
              <span :class="ns.e('label')">
                <slot name="option" :option="option" :level="level">{{ labelOf(option) }}</slot>
              </span>
              <DouSpinner
                v-if="loading.has(keyOf([...column.path, option.value]))"
                size="sm"
                :class="ns.e('suffix')"
              />
              <ChevronRightIcon
                v-else-if="!isLeaf(option, [...column.path, option.value])"
                :class="ns.e('suffix')"
              />
              <CheckIcon
                v-else-if="!multiple && isOnSelected([...column.path, option.value])"
                :class="[ns.e('suffix'), ns.e('check')]"
              />
            </li>
            <li
              v-if="!column.options.length && !loading.has(keyOf(column.path))"
              role="presentation"
              :class="ns.e('empty')"
            >
              <slot name="empty">{{ t('cascader.empty') }}</slot>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
