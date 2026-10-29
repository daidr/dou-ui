<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useReducedMotion } from '../../composables/use-motion'
import { useNamespace } from '../../utils/namespace'
import { isWindow, resolveScrollTarget, scrollTopOf, viewportOf } from '../../utils/scroll'
import { useLocale } from '../config-provider/use-config'
import type { AnchorExpose, AnchorItem, AnchorProps, AnchorSlots } from './anchor'
import AnchorList from './anchor-list.vue'

defineOptions({ name: 'DouAnchor' })

const props = withDefaults(defineProps<AnchorProps>(), {
  items: () => [],
  offset: 0,
  updateHash: true,
})
const active = defineModel<string>({ default: '' })
const emit = defineEmits<{ change: [href: string]; click: [event: MouseEvent, item: AnchorItem] }>()
const slots = defineSlots<AnchorSlots>()

const ns = useNamespace('anchor')
const reducedMotion = useReducedMotion()
const { t } = useLocale()
const nav = useTemplateRef<HTMLElement>('nav')

const hrefs = computed(() => {
  const list: string[] = []
  const walk = (items: AnchorItem[]) =>
    items.forEach((item) => {
      list.push(item.href)
      if (item.children) walk(item.children)
    })
  walk(props.items)
  return list
})

const findTarget = (href: string) => {
  if (!href.startsWith('#') || href.length < 2) return null
  return document.getElementById(decodeURIComponent(href.slice(1)))
}

let area: HTMLElement | Window | undefined
// While a click scrolls the page, the clicked link stays current, so the
// highlight does not flicker through every section on the way.
let pinned: string | undefined
let release: ReturnType<typeof setTimeout> | undefined

function setActive(href: string) {
  if (href === active.value) return
  active.value = href
  emit('change', href)
}

function update() {
  if (!area) return
  if (pinned) {
    clearTimeout(release)
    release = setTimeout(() => (pinned = undefined), 120)
    return
  }
  const top = viewportOf(area).top + props.offset
  const found = hrefs.value
    .map((href) => ({ href, el: findTarget(href) }))
    .filter((entry): entry is { href: string; el: HTMLElement } => !!entry.el)
  let current = ''
  for (const { href, el } of found) {
    // a few px of slack, so a heading scrolled to exactly the offset counts
    if (el.getBoundingClientRect().top - top <= 4) current = href
  }
  // At the very bottom the last sections may never reach the top.
  const bottom = isWindow(area)
    ? window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1
    : area.scrollTop + area.clientHeight >= area.scrollHeight - 1
  if (bottom && scrollTopOf(area) > 0 && found.length) current = found.at(-1)!.href
  setActive(current)
}

let frame = 0
const onScroll = () => {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(update)
}

function listen() {
  area?.removeEventListener('scroll', onScroll)
  area = resolveScrollTarget(props.target ?? window, null)
  area.addEventListener('scroll', onScroll, { passive: true })
  update()
}
onMounted(() => {
  listen()
  window.addEventListener('resize', onScroll)
})
onBeforeUnmount(() => {
  area?.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(frame)
  clearTimeout(release)
})
watch(() => props.target, listen)
watch(hrefs, () => nextTick(update))

function scrollTo(href: string) {
  const el = findTarget(href)
  if (!el || !area) return
  const distance = el.getBoundingClientRect().top - viewportOf(area).top - props.offset
  pinned = href
  setActive(href)
  area.scrollTo({
    top: scrollTopOf(area) + distance,
    behavior: reducedMotion.value ? 'auto' : 'smooth',
  })
  // A scroll that goes nowhere fires no event to release the pin.
  clearTimeout(release)
  release = setTimeout(() => (pinned = undefined), 1000)
  if (props.updateHash) history.replaceState(history.state, '', href)
  // Keyboard and screen reader users continue reading from the section.
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}

function onPick(event: MouseEvent, item: AnchorItem) {
  emit('click', event, item)
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return
  if (!findTarget(item.href)) return
  event.preventDefault()
  scrollTo(item.href)
}

/* the sliding marker */

const marker = ref<{ top: number; height: number }>()
watch(
  [active, () => props.items],
  async () => {
    await nextTick()
    const link = nav.value?.querySelector<HTMLElement>('.dou-anchor__link.is-active')
    marker.value = link ? { top: link.offsetTop, height: link.offsetHeight } : undefined
  },
  { immediate: true, flush: 'post' },
)

defineExpose<AnchorExpose>({ scrollTo, update })
</script>

<template>
  <nav ref="nav" :class="ns.b()" :aria-label="ariaLabel ?? t('anchor.label')">
    <span
      v-if="marker"
      :class="ns.e('marker')"
      :style="{ transform: `translateY(${marker.top}px)`, height: `${marker.height}px` }"
      aria-hidden="true"
    />
    <AnchorList :items="items" :level="0" :active="active" @pick="onPick">
      <template v-if="slots.item" #item="slotProps">
        <slot name="item" v-bind="slotProps" />
      </template>
    </AnchorList>
  </nav>
</template>
