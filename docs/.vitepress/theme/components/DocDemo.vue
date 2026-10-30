<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useId,
  useTemplateRef,
} from 'vue'
import type { Component } from 'vue'
import { CodeIcon } from '../icons'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  /** Path under docs/examples, without `.vue`, e.g. `button/size`. */
  src: string
  /** Stack the demo's children vertically. */
  column?: boolean
}>()

// Each example loads with the page that shows it; its highlighted source
// (see demo-code.ts) only when the code is first shown.
const examples = import.meta.glob<Component>('../../../examples/**/*.vue', { import: 'default' })
const sources = import.meta.glob<string>('../../../examples/**/*.vue', {
  query: '?highlight',
  import: 'default',
})

const key = computed(() => `../../../examples/${props.src}.vue`)
const demo = computed(() => {
  const load = examples[key.value]
  return load ? defineAsyncComponent(load) : null
})

const open = ref(false)
const html = shallowRef('')
const id = useId()
const root = useTemplateRef<HTMLElement>('root')
const text = () => root.value?.querySelector('pre')?.textContent ?? ''

async function prefetch() {
  if (!html.value) html.value = (await sources[key.value]?.()) ?? ''
}

async function toggle() {
  if (!open.value) await prefetch()
  open.value = !open.value
}

// The stage lets its content spill out, so badges, shadows, focus rings
// and anything that grows on hover stay whole. Only a demo too wide for
// its box, which would otherwise widen the page on a phone, turns into a
// horizontal scroller; a scroller clips on both axes, so it stays the
// exception rather than the rule.
const stage = useTemplateRef<HTMLElement>('stage')
const scrolls = ref(false)
let resize: ResizeObserver | undefined
let mutate: MutationObserver | undefined

function measure() {
  const el = stage.value
  if (el) scrolls.value = el.scrollWidth > el.clientWidth + 1
}

function watchChildren() {
  const el = stage.value
  if (!el || !resize) return
  resize.disconnect()
  resize.observe(el)
  for (const child of el.children) resize.observe(child)
}

onMounted(() => {
  resize = new ResizeObserver(measure)
  mutate = new MutationObserver(() => {
    watchChildren()
    measure()
  })
  if (stage.value) mutate.observe(stage.value, { childList: true })
  watchChildren()
})

onBeforeUnmount(() => {
  resize?.disconnect()
  mutate?.disconnect()
})

function collapse() {
  open.value = false
  // Keep the demo in view after a long source folds away.
  const rect = root.value?.getBoundingClientRect()
  if (rect && rect.top < 0) root.value?.scrollIntoView({ block: 'start' })
}
</script>

<template>
  <div ref="root" class="doc-demo" :class="{ 'is-open': open }">
    <div class="doc-demo__preview">
      <div class="doc-demo__bar">
        <DouTooltip :content="open ? '收起代码' : '查看代码'">
          <DouButton
            class="doc-demo__toggle"
            variant="ghost"
            size="sm"
            :aria-label="open ? '收起代码' : '查看代码'"
            :aria-expanded="open"
            :aria-controls="id"
            @pointerenter="prefetch"
            @focus="prefetch"
            @click="toggle"
          >
            <CodeIcon />
          </DouButton>
        </DouTooltip>
      </div>
      <div
        ref="stage"
        class="doc-demo__stage"
        :class="[$attrs.class, { 'doc-demo__stage--column': column, 'is-scrollable': scrolls }]"
        :style="$attrs.style as string"
      >
        <component :is="demo" v-if="demo" />
      </div>
    </div>
    <div :id="id" class="doc-demo__source" :inert="!open">
      <div class="doc-demo__code">
        <div v-if="html" class="doc-code">
          <div class="language-vue" v-html="html" />
          <DouCopyButton class="doc-code__copy" :text="text" size="sm" />
        </div>
        <button type="button" class="doc-demo__collapse" @click="collapse">收起代码</button>
      </div>
    </div>
  </div>
</template>
