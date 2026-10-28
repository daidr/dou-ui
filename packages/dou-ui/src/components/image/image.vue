<script setup lang="ts">
import { ImageIcon } from '@dou-ui/icons'
import { computed, ref, watch } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { ImageProps, ImageSlots } from './image'
import DouImagePreview from './image-preview.vue'
import { normalizePreview } from './preview'

defineOptions({ name: 'DouImage', inheritAttrs: false })

const props = withDefaults(defineProps<ImageProps>(), {
  fit: 'cover',
  lazy: false,
  preview: false,
})
const emit = defineEmits<{ load: [event: Event]; error: [event: Event] }>()
const slots = defineSlots<ImageSlots>()

const ns = useNamespace('image')
const { t } = useLocale()

type Status = 'loading' | 'loaded' | 'error'
const status = ref<Status>(props.src ? 'loading' : 'error')
const current = ref(props.src)
watch(
  () => props.src,
  (src) => {
    current.value = src
    status.value = src ? 'loading' : 'error'
  },
)

function onLoad(event: Event) {
  status.value = 'loaded'
  emit('load', event)
}
function onError(event: Event) {
  if (props.fallback && current.value !== props.fallback) {
    current.value = props.fallback
    return
  }
  status.value = 'error'
  emit('error', event)
}

const px = (value?: string | number) => (typeof value === 'number' ? `${value}px` : value)
const style = computed(() => ({
  width: px(props.width),
  height: px(props.height),
  '--dou-image-fit': props.fit,
}))

/* preview */

const canPreview = computed(() => props.preview && status.value === 'loaded')
const previewOpen = ref(false)
const previewImages = computed(() => {
  if (props.previewList?.length) return normalizePreview(props.previewList)
  return [{ src: props.previewSrc ?? current.value ?? '', alt: props.alt }]
})
const previewAt = ref(0)
function openPreview() {
  if (!canPreview.value) return
  const own = props.previewSrc ?? props.src
  const found = previewImages.value.findIndex((image) => image.src === own)
  previewAt.value = props.previewIndex ?? Math.max(0, found)
  previewOpen.value = true
}
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  openPreview()
}
</script>

<template>
  <div
    v-bind="$attrs"
    :class="[ns.b(), ns.is(status, true), ns.is('previewable', canPreview)]"
    :style="style"
    :role="canPreview ? 'button' : undefined"
    :tabindex="canPreview ? 0 : undefined"
    :aria-label="canPreview ? alt || t('image.preview') : undefined"
    :aria-haspopup="canPreview ? 'dialog' : undefined"
    @click="openPreview"
    @keydown="canPreview ? onKeydown($event) : undefined"
  >
    <img
      v-if="current && status !== 'error'"
      :class="ns.e('inner')"
      :src="current"
      :alt="alt ?? ''"
      :loading="lazy ? 'lazy' : undefined"
      decoding="async"
      @load="onLoad"
      @error="onError"
    />
    <div v-if="status === 'loading'" :class="ns.e('placeholder')">
      <slot name="placeholder" />
    </div>
    <div v-else-if="status === 'error'" :class="ns.e('error')">
      <slot name="error">
        <ImageIcon />
        <span v-if="alt" :class="ns.e('alt')">{{ alt }}</span>
        <span v-else :class="ns.e('sr')">{{ t('image.error') }}</span>
      </slot>
    </div>
  </div>
  <DouImagePreview
    v-if="preview"
    v-model:open="previewOpen"
    v-model:index="previewAt"
    :images="previewImages"
  />
</template>
