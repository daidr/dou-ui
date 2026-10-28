<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { isWindow, resolveScrollTarget, viewportOf } from '../../utils/scroll'
import type { AffixExpose, AffixProps } from './affix'

defineOptions({ name: 'DouAffix' })

const props = withDefaults(defineProps<AffixProps>(), { offsetTop: 0 })
const emit = defineEmits<{ change: [fixed: boolean] }>()

const ns = useNamespace('affix')
const root = useTemplateRef<HTMLElement>('root')
const content = useTemplateRef<HTMLElement>('content')

const fixed = ref(false)
const box = ref({ left: 0, width: 0, height: 0, edge: 0 })

function update() {
  if (!root.value || !content.value) return
  const rect = root.value.getBoundingClientRect()
  const area = viewportOf(resolveScrollTarget(props.target, root.value))
  let next = false
  let edge = 0
  if (props.offsetBottom !== undefined) {
    // The placeholder keeps the content's place, so its rect is where the content would be.
    next = rect.top + content.value.offsetHeight + props.offsetBottom > area.bottom
    edge = window.innerHeight - area.bottom + props.offsetBottom
  } else {
    next = rect.top - props.offsetTop < area.top
    edge = area.top + props.offsetTop
  }
  box.value = { left: rect.left, width: rect.width, height: content.value.offsetHeight, edge }
  if (next !== fixed.value) {
    fixed.value = next
    emit('change', next)
  }
}

let target: HTMLElement | Window | undefined
let observer: ResizeObserver | undefined
function listen() {
  unlisten()
  target = resolveScrollTarget(props.target, root.value)
  target.addEventListener('scroll', update, { passive: true })
  // A scroll container also moves when the page around it scrolls.
  if (!isWindow(target)) window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(update)
    observer.observe(root.value)
  }
  update()
}
function unlisten() {
  target?.removeEventListener('scroll', update)
  window.removeEventListener('scroll', update)
  window.removeEventListener('resize', update)
  observer?.disconnect()
}
onMounted(listen)
onBeforeUnmount(unlisten)
watch(() => [props.target, props.offsetTop, props.offsetBottom], listen)

const rootStyle = computed<CSSProperties | undefined>(() =>
  fixed.value ? { height: `${box.value.height}px` } : undefined,
)
const contentStyle = computed<CSSProperties | undefined>(() => {
  if (!fixed.value) return undefined
  return {
    position: 'fixed',
    left: `${box.value.left}px`,
    width: `${box.value.width}px`,
    [props.offsetBottom !== undefined ? 'bottom' : 'top']: `${box.value.edge}px`,
  }
})

defineExpose<AffixExpose>({ update })
</script>

<template>
  <div ref="root" :class="ns.b()" :style="rootStyle">
    <div ref="content" :class="[ns.e('content'), ns.is('fixed', fixed)]" :style="contentStyle">
      <slot />
    </div>
  </div>
</template>
