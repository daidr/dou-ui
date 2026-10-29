<script setup lang="ts">
import { SidebarCollapseIcon, SidebarExpandIcon } from '@dou-ui/icons'
import { computed, inject, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import DouDrawer from '../drawer/drawer.vue'
import { layoutKey } from './layout'
import type {
  LayoutAsideProps,
  LayoutAsideSlotProps,
  LayoutAsideSlots,
  LayoutDrawer,
} from './layout'

defineOptions({ name: 'DouLayoutAside' })

const props = withDefaults(defineProps<LayoutAsideProps>(), {
  width: 240,
  collapsedWidth: 64,
  collapsible: false,
  sticky: false,
  bordered: true,
  side: 'left',
})
const collapsed = defineModel<boolean>('collapsed', { default: false })
const open = defineModel<boolean>('open', { default: false })
const slots = defineSlots<LayoutAsideSlots>()

const ns = useNamespace('layout-aside')
const { t } = useLocale()
const layout = inject(layoutKey, null)
const id = `dou-layout-aside-${useId()}`

const px = (value: number | string) => (typeof value === 'number' ? `${value}px` : value)

const style = computed(() => ({
  '--dou-layout-aside-width': px(collapsed.value ? props.collapsedWidth : props.width),
  '--dou-layout-aside-top': props.sticky ? (layout?.stickyTop.value ?? '0px') : undefined,
}))

// Below the breakpoint the aside becomes a drawer. The server cannot
// measure the viewport, so the page starts with the aside in place.
const narrow = ref(false)
let query: MediaQueryList | undefined
const sync = () => (narrow.value = !!query?.matches)
function listen() {
  query?.removeEventListener('change', sync)
  query =
    props.breakpoint === undefined
      ? undefined
      : window.matchMedia?.(`(max-width: ${props.breakpoint - 0.02}px)`)
  query?.addEventListener('change', sync)
  sync()
}
onMounted(() => {
  listen()
  watch(() => props.breakpoint, listen)
})

const handle: LayoutDrawer = { open, id }
watch(narrow, (value) => {
  if (!value) open.value = false
  if (!layout) return
  if (value) layout.drawer.value = handle
  else if (layout.drawer.value === handle) layout.drawer.value = undefined
})
onBeforeUnmount(() => {
  query?.removeEventListener('change', sync)
  if (layout?.drawer.value === handle) layout.drawer.value = undefined
})

const slotProps = computed<LayoutAsideSlotProps>(() => ({
  collapsed: narrow.value ? false : collapsed.value,
  drawer: narrow.value,
  close: () => (open.value = false),
}))
</script>

<template>
  <DouDrawer
    v-if="narrow"
    :id="id"
    v-model:open="open"
    :class="`${ns.b()}-drawer`"
    :placement="side"
    :size="width"
    :closable="false"
    :aria-label="t('layout.open')"
  >
    <div :class="ns.e('body')"><slot v-bind="slotProps" /></div>
    <div v-if="slots.footer" :class="ns.e('footer')">
      <slot name="footer" v-bind="slotProps" />
    </div>
  </DouDrawer>
  <aside
    v-else
    :class="[
      ns.b(),
      ns.is('collapsed', collapsed),
      ns.is('sticky', sticky),
      ns.is('bordered', bordered),
    ]"
    :style="style"
  >
    <div :class="ns.e('body')"><slot v-bind="slotProps" /></div>
    <div v-if="slots.footer || collapsible" :class="ns.e('footer')">
      <slot name="footer" v-bind="slotProps" />
      <button
        v-if="collapsible"
        type="button"
        :class="ns.e('toggle')"
        :aria-label="t(collapsed ? 'layout.expand' : 'layout.collapse')"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <component :is="collapsed ? SidebarExpandIcon : SidebarCollapseIcon" />
      </button>
    </div>
  </aside>
</template>
