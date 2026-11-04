<script setup lang="ts">
import { CheckIcon, CloseIcon } from '@dou-ui/icons'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DouTooltip } from '../tooltip'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { StepItem, StepStatus, StepsProps, StepsSlots } from './steps'

defineOptions({ name: 'DouSteps' })

const props = withDefaults(defineProps<StepsProps>(), {
  items: () => [],
  status: 'running',
  direction: 'horizontal',
  size: 'md',
  clickable: false,
})
const current = defineModel<number>('current', { default: 0 })
const emit = defineEmits<{ change: [current: number] }>()
defineSlots<StepsSlots>()

const ns = useNamespace('steps')
const { t } = useLocale()

function statusOf(item: StepItem, index: number): StepStatus {
  if (item.status) return item.status
  if (index < current.value) return 'done'
  if (index === current.value) return props.status
  return 'pending'
}

/*
 * A horizontal row that does not fit its line keeps only the current
 * step's title; the others are read out and shown on hover. If even the
 * markers do not fit, the row scrolls, with the current step in view.
 */
const root = ref<HTMLOListElement>()
const compact = ref(false)
/** The width the row needs with every title, measured when it last overflowed. */
let fullWidth = 0
let observer: ResizeObserver | undefined

function measure() {
  const el = root.value
  if (!el) return
  if (props.direction !== 'horizontal') {
    compact.value = false
    return
  }
  if (!compact.value) {
    if (el.scrollWidth > el.clientWidth + 1) {
      fullWidth = el.scrollWidth
      compact.value = true
      void nextTick(reveal)
    }
  } else if (innerWidth(el) >= fullWidth) {
    compact.value = false
  } else {
    reveal()
  }
}

/** The width inside the padding that only the compact row has. */
function innerWidth(el: HTMLElement) {
  const style = getComputedStyle(el)
  return (
    el.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
  )
}

/** Scrolls the row, never the page, so the current step shows inside the padding kept for the focus ring. */
function reveal() {
  const el = root.value
  const item = el?.children[current.value] as HTMLElement | undefined
  if (!el || !item || el.scrollWidth <= el.clientWidth) return
  const style = getComputedStyle(el)
  const box = el.getBoundingClientRect()
  const left = box.left + el.clientLeft + (parseFloat(style.paddingLeft) || 0)
  const right = box.left + el.clientLeft + el.clientWidth - (parseFloat(style.paddingRight) || 0)
  const rect = item.getBoundingClientRect()
  // the line after a step is not part of it: align the step's own content
  const main = item.firstElementChild?.getBoundingClientRect() ?? rect
  if (main.left < left) el.scrollLeft -= left - main.left
  else if (main.right > right) el.scrollLeft += main.right - right
}

/** Measures again with every title shown, after the steps change. */
function remeasure() {
  compact.value = false
  void nextTick(measure)
}

/*
 * The row is measured again when its own width changes, when a step's
 * text changes size (a late title, a web font), and when what the steps
 * say changes, wherever that is rendered (a slot is rendered inside the
 * tooltip's trigger, not by this component). Hidden titles keep their
 * 1px box, so fonts loading also measures again.
 */
let said = ''
function whatItSays() {
  const el = root.value
  if (!el) return ''
  const titles = [...el.querySelectorAll<HTMLElement>('.' + ns.e('text'))].map((text) => {
    const status = text.querySelector('.' + ns.e('status'))?.textContent ?? ''
    return (text.textContent ?? '').replace(status, '')
  })
  return [props.direction, props.size, ...titles].join('\n')
}

function watchTexts() {
  const el = root.value
  if (!observer || !el) return
  observer.disconnect()
  observer.observe(el)
  el.querySelectorAll('.' + ns.e('text')).forEach((text) => observer!.observe(text))
}

const onFonts = () => remeasure()

function onChange() {
  const now = whatItSays()
  if (now === said) return
  said = now
  watchTexts()
  remeasure()
}

let mutations: MutationObserver | undefined

onMounted(() => {
  said = whatItSays()
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure())
    watchTexts()
  }
  if (typeof MutationObserver !== 'undefined' && root.value) {
    mutations = new MutationObserver(onChange)
    mutations.observe(root.value, { childList: true, characterData: true, subtree: true })
  }
  document.fonts?.addEventListener('loadingdone', onFonts)
})
watch(
  () => [props.direction, props.size],
  () => void nextTick(onChange),
)
onBeforeUnmount(() => {
  observer?.disconnect()
  mutations?.disconnect()
  document.fonts?.removeEventListener('loadingdone', onFonts)
})
watch(current, () => void nextTick(measure))

function go(item: StepItem, index: number) {
  if (!props.clickable || item.disabled || index === current.value) return
  current.value = index
  emit('change', index)
}
</script>

<template>
  <ol
    ref="root"
    :class="[
      ns.b(),
      ns.m(direction),
      ns.m(size),
      ns.is('clickable', clickable),
      ns.is('compact', compact),
    ]"
  >
    <li
      v-for="(item, index) in items"
      :key="index"
      :class="[ns.e('item'), ns.is(statusOf(item, index)), ns.is('disabled', !!item.disabled)]"
      :aria-current="index === current ? 'step' : undefined"
    >
      <DouTooltip :disabled="!compact || index === current">
        <template #content>
          <slot name="title" :item="item" :index="index" :status="statusOf(item, index)">
            {{ item.title }}
          </slot>
          <span v-if="item.description || $slots.description" :class="ns.e('tip-description')">
            <slot name="description" :item="item" :index="index" :status="statusOf(item, index)">
              {{ item.description }}
            </slot>
          </span>
        </template>
        <component
          :is="clickable ? 'button' : 'div'"
          :type="clickable ? 'button' : undefined"
          :disabled="clickable && item.disabled ? true : undefined"
          :class="ns.e('main')"
          @click="go(item, index)"
        >
          <span :class="ns.e('marker')" aria-hidden="true">
            <component :is="item.icon" v-if="item.icon" :class="ns.e('icon')" />
            <CheckIcon v-else-if="statusOf(item, index) === 'done'" :stroke-width="1.75" />
            <CloseIcon v-else-if="statusOf(item, index) === 'error'" :stroke-width="1.75" />
            <span v-else :class="ns.e('number')">{{ index + 1 }}</span>
          </span>
          <span :class="ns.e('text')">
            <span :class="ns.e('title')">
              <slot name="title" :item="item" :index="index" :status="statusOf(item, index)">
                {{ item.title }}
              </slot>
              <span :class="ns.e('status')">{{ ' ' + t(`steps.${statusOf(item, index)}`) }}</span>
            </span>
            <span v-if="item.description || $slots.description" :class="ns.e('description')">
              <slot name="description" :item="item" :index="index" :status="statusOf(item, index)">
                {{ item.description }}
              </slot>
            </span>
          </span>
        </component>
      </DouTooltip>
      <span v-if="index < items.length - 1" :class="ns.e('line')" aria-hidden="true" />
    </li>
  </ol>
</template>
