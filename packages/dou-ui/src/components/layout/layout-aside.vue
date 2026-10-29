<script setup lang="ts">
import { SidebarCollapseIcon, SidebarExpandIcon } from '@dou-ui/icons'
import { computed, inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { layoutKey } from './layout'
import type { LayoutAsideProps, LayoutAsideSlots } from './layout'

defineOptions({ name: 'DouLayoutAside' })

const props = withDefaults(defineProps<LayoutAsideProps>(), {
  width: 240,
  collapsedWidth: 64,
  collapsible: false,
  sticky: false,
  bordered: true,
})
const collapsed = defineModel<boolean>('collapsed', { default: false })
const slots = defineSlots<LayoutAsideSlots>()

const ns = useNamespace('layout-aside')
const { t } = useLocale()
const layout = inject(layoutKey, null)

const px = (value: number | string) => (typeof value === 'number' ? `${value}px` : value)

const style = computed(() => ({
  '--dou-layout-aside-width': px(collapsed.value ? props.collapsedWidth : props.width),
  '--dou-layout-aside-top': props.sticky ? (layout?.stickyTop.value ?? '0px') : undefined,
}))
</script>

<template>
  <aside
    :class="[
      ns.b(),
      ns.is('collapsed', collapsed),
      ns.is('sticky', sticky),
      ns.is('bordered', bordered),
    ]"
    :style="style"
  >
    <div :class="ns.e('body')"><slot :collapsed="collapsed" /></div>
    <div v-if="slots.footer || collapsible" :class="ns.e('footer')">
      <slot name="footer" :collapsed="collapsed" />
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
