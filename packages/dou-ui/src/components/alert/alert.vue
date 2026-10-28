<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import { computed, ref } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { toneIcon } from '../../utils/tone-icons'
import { useLocale } from '../config-provider/use-config'
import type { AlertEmits, AlertProps, AlertSlots } from './alert'

defineOptions({ name: 'DouAlert' })

const props = withDefaults(defineProps<AlertProps>(), {
  tone: 'neutral',
  closable: false,
  showIcon: true,
})
const emit = defineEmits<AlertEmits>()
const slots = defineSlots<AlertSlots>()

const ns = useNamespace('alert')
const { t } = useLocale()
const visible = ref(true)

// Warnings and errors interrupt a screen reader; everything else waits its turn.
const role = computed(() =>
  props.tone === 'warning' || props.tone === 'danger' ? 'alert' : 'status',
)
const hasTitle = computed(() => !!props.title || !!slots.title)
const Icon = () => toneIcon(props.tone)

function close(event: MouseEvent) {
  visible.value = false
  emit('close', event)
}
</script>

<template>
  <div v-if="visible" :class="[ns.b(), ns.m(tone), ns.is('titled', hasTitle)]" :role="role">
    <span v-if="showIcon" :class="ns.e('icon')">
      <slot name="icon"><Icon /></slot>
    </span>
    <div :class="ns.e('content')">
      <div v-if="hasTitle" :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </div>
      <div v-if="slots.default" :class="ns.e('description')"><slot /></div>
    </div>
    <div v-if="slots.action" :class="ns.e('action')"><slot name="action" /></div>
    <button
      v-if="closable"
      type="button"
      :class="ns.e('close')"
      :aria-label="t('alert.close')"
      @click="close"
    >
      <CloseIcon />
    </button>
  </div>
</template>
