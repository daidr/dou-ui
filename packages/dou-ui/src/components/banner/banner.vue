<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import { computed, ref } from 'vue'
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

const inner = ref(true)
const visible = computed(() => props.open ?? inner.value)

const hasTitle = computed(() => !!props.title || !!slots.title)
const Icon = () => toneIcon(props.tone)

function close(event: MouseEvent) {
  inner.value = false
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
