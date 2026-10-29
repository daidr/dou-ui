<script setup lang="ts">
import { computed, nextTick, onScopeDispose, provide, ref, useId, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useFloating } from '../../composables/use-floating'
import { useLayer } from '../../composables/use-layer'
import { useThemeScope } from '../../composables/use-theme-scope'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild, onlyChildElement } from '../../utils/only-child'
import { useZIndex } from '../config-provider/use-config'
import { dropdownKey } from '../dropdown/dropdown'
import type { DropdownValue } from '../dropdown/dropdown'
import { useMenuKeys } from '../dropdown/menu-keys'
import type { ContextMenuExpose, ContextMenuProps, ContextMenuSlots } from './context-menu'

defineOptions({ name: 'DouContextMenu', inheritAttrs: false })

const props = withDefaults(defineProps<ContextMenuProps>(), {
  disabled: false,
  hideOnSelect: true,
  teleport: 'body',
})
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [value: DropdownValue | undefined] }>()
defineSlots<ContextMenuSlots>()

const ns = useNamespace('context-menu')
const dropdown = useNamespace('dropdown')
const id = `dou-context-menu-${useId()}`

const targetRef = ref<ComponentPublicInstance | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const target = () => onlyChildElement(targetRef.value)

// The menu hangs off a zero-size box at the point that opened it.
const point = ref({ x: 0, y: 0 })
const anchor = {
  getBoundingClientRect: () => new DOMRect(point.value.x, point.value.y, 0, 0),
}
const floating = useFloating(() => anchor, panelRef, {
  open,
  placement: 'bottom-start',
  offset: 2,
})

const rendered = ref(open.value)
const zIndex = ref<number>()
const { next } = useZIndex()
const { theme, sync } = useThemeScope(target)

// Where focus was before the menu opened, to hand it back on Escape.
let restore: HTMLElement | null = null

watch(open, (value) => {
  if (!value) return
  rendered.value = true
  zIndex.value = next()
  sync()
})

function show(x: number, y: number) {
  if (props.disabled) return
  point.value = { x, y }
  if (!open.value) {
    const active = document.activeElement
    restore = active instanceof HTMLElement && !panelRef.value?.contains(active) ? active : null
  }
  open.value = true
  void nextTick(() => {
    floating.update()
    panelRef.value?.focus({ preventScroll: true })
  })
}

function hide() {
  open.value = false
}

function dismiss() {
  const back = !!panelRef.value?.contains(document.activeElement)
  hide()
  if (back) (restore ?? (target() as HTMLElement | null))?.focus()
}

function onContextmenu(event: MouseEvent) {
  if (props.disabled) return
  event.preventDefault()
  // A menu opened from the keyboard has no pointer position: open it at
  // the bottom left of the focused element instead.
  if (event.button === -1 || (event.clientX === 0 && event.clientY === 0)) {
    const source = event.target instanceof Element ? event.target : target()
    const box = source?.getBoundingClientRect()
    show(box?.left ?? 0, box?.bottom ?? 0)
    return
  }
  show(event.clientX, event.clientY)
}

useLayer({
  open,
  elements: () => [panelRef.value],
  onEscape: dismiss,
  onOutside: hide,
})

// The menu stays where it was opened, so scrolling the page under it closes it.
function onScroll(event: Event) {
  if (event.target instanceof Node && panelRef.value?.contains(event.target)) return
  hide()
}
watch(open, (value) => {
  if (typeof window === 'undefined') return
  const method = value ? 'addEventListener' : 'removeEventListener'
  window[method]('scroll', onScroll, { capture: true, passive: true })
  window[method]('resize', hide)
  window[method]('blur', hide)
})
onScopeDispose(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('scroll', onScroll, { capture: true })
  window.removeEventListener('resize', hide)
  window.removeEventListener('blur', hide)
})

const onMenuKeydown = useMenuKeys(
  () => panelRef.value,
  () => dismiss(),
)

provide(dropdownKey, {
  select(value) {
    emit('select', value)
    if (props.hideOnSelect) dismiss()
  },
})

const panelStyle = computed(() => ({ ...floating.style.value, zIndex: zIndex.value }))

defineExpose<ContextMenuExpose>({ open: show, close: hide })
</script>

<template>
  <OnlyChild ref="targetRef" @contextmenu="onContextmenu"><slot /></OnlyChild>
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition name="dou-floating">
      <div
        v-show="open"
        :id="id"
        ref="panelRef"
        role="menu"
        tabindex="-1"
        :class="[dropdown.b(), ns.b(), 'dou-floating']"
        :style="panelStyle"
        :data-placement="floating.placement.value"
        :data-dou-theme="theme"
        v-bind="$attrs"
        @keydown="onMenuKeydown"
        @contextmenu.prevent
      >
        <slot name="menu" />
      </div>
    </Transition>
  </Teleport>
</template>
