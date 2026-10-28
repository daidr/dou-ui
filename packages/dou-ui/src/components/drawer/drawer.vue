<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
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
})
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ open: []; opened: []; close: []; closed: [] }>()
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

const size = computed(() =>
  typeof props.size === 'number' ? `${props.size}px` : (props.size ?? undefined),
)

defineExpose<DrawerExpose>({ close })
</script>

<template>
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition name="dou-drawer" @after-enter="emit('opened')" @after-leave="onAfterLeave">
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
