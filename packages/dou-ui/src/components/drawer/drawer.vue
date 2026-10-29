<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import { computed, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { useModal } from '../../composables/use-modal'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { DrawerExpose, DrawerProps, DrawerSlots } from './drawer'

defineOptions({ name: 'DouDrawer', inheritAttrs: false })

const props = withDefaults(defineProps<DrawerProps>(), {
  placement: 'right',
  closable: true,
  closeOnMask: true,
  closeOnEscape: true,
  lockScroll: true,
  destroyOnClose: false,
  teleport: 'body',
  resizable: false,
  minSize: 200,
})
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  'update:size': [size: number]
  open: []
  opened: []
  close: []
  closed: []
}>()
const slots = defineSlots<DrawerSlots>()

const ns = useNamespace('drawer')
const { t } = useLocale()
const id = `dou-drawer-${useId()}`
const hasTitle = computed(() => !!props.title || !!slots.title)

async function close() {
  if (props.beforeClose && (await props.beforeClose()) === false) return
  open.value = false
}

const root = useTemplateRef<HTMLElement>('root')
const panel = useTemplateRef<HTMLElement>('panel')
const { rendered, zIndex, theme, maskListeners } = useModal({
  open,
  root,
  panel,
  closeOnEscape: () => props.closeOnEscape,
  closeOnMask: () => props.closeOnMask,
  lockScroll: () => props.lockScroll,
  requestClose: close,
})

// With `destroyOnClose` the content goes once the closing transition ends.
const mounted = ref(open.value)
watch(open, (value) => {
  if (value) mounted.value = true
  if (value) emit('open')
  else emit('close')
})
function onAfterLeave() {
  if (props.destroyOnClose) mounted.value = false
  emit('closed')
}

/* resizing from the inner edge: kept here, and reported for `v-model:size` */

const resized = ref<number | null>(null)
watch(
  () => props.size,
  () => (resized.value = null),
)
const horizontal = computed(() => props.placement === 'left' || props.placement === 'right')
const viewportSize = () => (horizontal.value ? window.innerWidth : window.innerHeight)

function setSize(value: number) {
  const max = props.maxSize ?? viewportSize() - 48
  const next = Math.round(Math.min(Math.max(value, props.minSize), Math.max(max, props.minSize)))
  if (next === resized.value) return
  resized.value = next
  emit('update:size', next)
}

const currentSize = () =>
  resized.value ??
  (panel.value
    ? horizontal.value
      ? panel.value.getBoundingClientRect().width
      : panel.value.getBoundingClientRect().height
    : props.minSize)

let stopResize: (() => void) | undefined
function onResizeStart(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  // The size is the distance from the pointer to the edge the drawer comes from.
  const sizeAt = (e: PointerEvent) =>
    ({
      left: e.clientX,
      right: window.innerWidth - e.clientX,
      top: e.clientY,
      bottom: window.innerHeight - e.clientY,
    })[props.placement]
  const move = (e: PointerEvent) => setSize(sizeAt(e))
  const up = () => stopResize?.()
  stopResize = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    document.documentElement.classList.remove(
      'dou-drawer-resizing',
      `dou-drawer-resizing--${props.placement}`,
    )
    stopResize = undefined
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
  document.documentElement.classList.add(
    'dou-drawer-resizing',
    `dou-drawer-resizing--${props.placement}`,
  )
}
onBeforeUnmount(() => stopResize?.())

function onResizeKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 64 : 16
  // The keys that point away from the drawer's edge make it bigger.
  const grow: Record<string, string> = {
    left: 'ArrowRight',
    right: 'ArrowLeft',
    top: 'ArrowDown',
    bottom: 'ArrowUp',
  }
  const shrink: Record<string, string> = {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    top: 'ArrowUp',
    bottom: 'ArrowDown',
  }
  let next: number | undefined
  if (event.key === grow[props.placement]) next = currentSize() + step
  else if (event.key === shrink[props.placement]) next = currentSize() - step
  else if (event.key === 'Home') next = props.minSize
  else if (event.key === 'End') next = props.maxSize ?? viewportSize() - 48
  if (next === undefined) return
  event.preventDefault()
  setSize(next)
}

const size = computed(() => {
  const value = resized.value ?? props.size
  return typeof value === 'number' ? `${value}px` : (value ?? undefined)
})

defineExpose<DrawerExpose>({ close })
</script>

<template>
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition appear name="dou-drawer" @after-enter="emit('opened')" @after-leave="onAfterLeave">
      <div
        v-show="open"
        ref="root"
        :class="[ns.b(), ns.m(placement)]"
        :style="{ zIndex }"
        :data-dou-theme="theme"
        v-bind="maskListeners"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-labelledby="hasTitle ? `${id}-title` : undefined"
          :class="ns.e('panel')"
          :style="{ '--dou-drawer-size': size }"
          v-bind="$attrs"
        >
          <div
            v-if="resizable"
            :class="ns.e('resizer')"
            role="separator"
            tabindex="0"
            :aria-orientation="horizontal ? 'vertical' : 'horizontal'"
            :aria-label="t('drawer.resize')"
            :aria-valuenow="resized ?? undefined"
            :aria-valuemin="minSize"
            :aria-valuemax="maxSize"
            @pointerdown="onResizeStart"
            @keydown="onResizeKey"
          />
          <template v-if="mounted">
            <header v-if="hasTitle || closable" :class="ns.e('header')">
              <div
                v-if="hasTitle"
                :id="`${id}-title`"
                role="heading"
                aria-level="2"
                :class="ns.e('title')"
              >
                <slot name="title">{{ title }}</slot>
              </div>
              <button
                v-if="closable"
                type="button"
                :class="ns.e('close')"
                :aria-label="t('drawer.close')"
                @click="close"
              >
                <CloseIcon />
              </button>
            </header>
            <div :class="ns.e('body')"><slot /></div>
            <footer v-if="slots.footer" :class="ns.e('footer')">
              <slot name="footer" :close="close" />
            </footer>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
