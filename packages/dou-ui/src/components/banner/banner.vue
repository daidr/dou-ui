<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import { computed, onMounted, ref, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { toneIcon } from '../../utils/tone-icons'
import { useLocale } from '../config-provider/use-config'
import type { BannerEmits, BannerProps, BannerSlots } from './banner'

defineOptions({ name: 'DouBanner' })

const props = withDefaults(defineProps<BannerProps>(), {
  tone: 'neutral',
  variant: 'soft',
  showIcon: true,
  closable: false,
  open: undefined,
})
const emit = defineEmits<BannerEmits>()
const slots = defineSlots<BannerSlots>()

const ns = useNamespace('banner')
const { t } = useLocale()

const STORAGE_VALUE = 'closed'
function read(key: string) {
  try {
    return localStorage.getItem(key) === STORAGE_VALUE
  } catch {
    return false
  }
}
function write(key: string) {
  try {
    localStorage.setItem(key, STORAGE_VALUE)
  } catch {
    // storage can be unavailable, e.g. in a private window; the banner just closes
  }
}

const inner = ref(true)
const open = computed(() => props.open ?? inner.value)
// Storage is only read in the browser, after hydration, so the server
// and the client render the same banner first.
const remembered = ref(false)
onMounted(() => {
  if (props.storageKey) remembered.value = read(props.storageKey)
})
watch(
  () => props.storageKey,
  (key) => (remembered.value = !!key && read(key)),
)
const visible = computed(() => open.value && !remembered.value)

const hasTitle = computed(() => !!props.title || !!slots.title)
const Icon = () => toneIcon(props.tone)

function close(event: MouseEvent) {
  inner.value = false
  if (props.storageKey) {
    write(props.storageKey)
    remembered.value = true
  }
  emit('update:open', false)
  emit('close', event)
}
</script>

<template>
  <section
    v-if="visible"
    :class="[ns.b(), ns.m(tone), ns.m(variant)]"
    :aria-label="title ?? t('banner.label')"
  >
    <div :class="ns.e('content')">
      <div :class="ns.e('main')">
        <span v-if="showIcon" :class="ns.e('icon')" aria-hidden="true">
          <slot name="icon"><Icon /></slot>
        </span>
        <p :class="ns.e('text')">
          <strong v-if="hasTitle" :class="ns.e('title')">
            <slot name="title">{{ title }}</slot>
          </strong>
          <slot />
        </p>
      </div>
      <div v-if="slots.action" :class="ns.e('action')"><slot name="action" /></div>
    </div>
    <button
      v-if="closable"
      type="button"
      :class="ns.e('close')"
      :aria-label="t('banner.close')"
      @click="close"
    >
      <CloseIcon />
    </button>
  </section>
</template>
