<script setup lang="ts">
import { CloseIcon, MaximizeIcon, MinimizeIcon } from '@dou-ui/icons'
import { computed, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { useModal } from '../../composables/use-modal'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { DialogExpose, DialogProps, DialogSlots } from './dialog'
import { useTeleport } from '../../utils/teleport'

defineOptions({ name: 'DouDialog', inheritAttrs: false })

const props = withDefaults(defineProps<DialogProps>(), {
  centered: false,
  closable: true,
  closeOnMask: true,
  closeOnEscape: true,
  lockScroll: true,
  destroyOnClose: false,
  teleport: undefined,
  draggable: false,
  fullscreenable: false,
})
const teleportTarget = useTeleport(() => props.teleport)
const open = defineModel<boolean>('open', { default: false })
const fullscreen = defineModel<boolean>('fullscreen', { default: false })
const emit = defineEmits<{ open: []; opened: []; close: []; closed: [] }>()
const slots = defineSlots<DialogSlots>()

const ns = useNamespace('dialog')
const { t } = useLocale()
const id = `dou-dialog-${useId()}`
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

/* dragging by the header: the panel moves by `translate`, back in place on each open */

const offset = ref({ x: 0, y: 0 })
const canDrag = computed(() => props.draggable && !fullscreen.value)
watch(open, (value) => value && (offset.value = { x: 0, y: 0 }))

const clamp = (value: number, [min, max]: readonly [number, number]) =>
  Math.min(Math.max(value, min), max)

let stopDrag: (() => void) | undefined
function onHeaderPointerdown(event: PointerEvent) {
  if (!canDrag.value || event.button !== 0) return
  if ((event.target as Element).closest('button, a, input, textarea, select')) return
  const rect = panel.value?.getBoundingClientRect()
  if (!rect) return
  event.preventDefault()
  const start = { x: event.clientX, y: event.clientY }
  const from = { ...offset.value }
  // Keep the whole panel in the viewport, or at least its top-left when it is larger.
  const range = {
    x: [from.x - rect.left, from.x + Math.max(0, window.innerWidth - rect.right)],
    y: [from.y - rect.top, from.y + Math.max(0, window.innerHeight - rect.bottom)],
  } as const
  const move = (e: PointerEvent) => {
    offset.value = {
      x: clamp(from.x + e.clientX - start.x, range.x),
      y: clamp(from.y + e.clientY - start.y, range.y),
    }
  }
  const up = () => stopDrag?.()
  stopDrag = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    document.documentElement.classList.remove('dou-dialog-dragging')
    stopDrag = undefined
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
  document.documentElement.classList.add('dou-dialog-dragging')
}
onBeforeUnmount(() => stopDrag?.())

const panelStyle = computed(() => ({
  width: fullscreen.value ? undefined : width.value,
  translate:
    canDrag.value && (offset.value.x || offset.value.y)
      ? `${offset.value.x}px ${offset.value.y}px`
      : undefined,
}))

const width = computed(() =>
  typeof props.width === 'number' ? `${props.width}px` : (props.width ?? undefined),
)

defineExpose<DialogExpose>({ close })
</script>

<template>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-dialog" @after-enter="emit('opened')" @after-leave="onAfterLeave">
      <div
        v-show="open"
        ref="root"
        :class="[ns.b(), ns.is('centered', centered), ns.is('fullscreen', fullscreen)]"
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
          :class="[ns.e('panel'), ns.is('draggable', canDrag)]"
          :style="panelStyle"
          v-bind="$attrs"
        >
          <template v-if="mounted">
            <header
              v-if="hasTitle || closable || fullscreenable"
              :class="ns.e('header')"
              @pointerdown="onHeaderPointerdown"
            >
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
                v-if="fullscreenable"
                type="button"
                :class="[ns.e('close'), ns.e('fullscreen')]"
                :aria-label="t(fullscreen ? 'dialog.exitFullscreen' : 'dialog.fullscreen')"
                @click="fullscreen = !fullscreen"
              >
                <MinimizeIcon v-if="fullscreen" />
                <MaximizeIcon v-else />
              </button>
              <button
                v-if="closable"
                type="button"
                :class="ns.e('close')"
                :aria-label="t('dialog.close')"
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
