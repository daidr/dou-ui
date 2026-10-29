<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormSize } from '../form/use-form-item'
import type { TagEmits, TagProps, TagSlots } from './tag'

defineOptions({ name: 'DouTag' })

const props = withDefaults(defineProps<TagProps>(), {
  variant: 'soft',
  tone: 'neutral',
  closable: false,
  round: false,
})
const emit = defineEmits<TagEmits>()
const slots = defineSlots<TagSlots>()

const ns = useNamespace('tag')
const { t } = useLocale()
const size = useFormSize(() => props.size)

const classes = computed(() => [
  ns.b(),
  ns.m(props.variant),
  ns.m(props.tone),
  ns.m(size.value),
  ns.is('round', props.round),
])
</script>

<template>
  <span :class="classes">
    <span v-if="slots.leading" :class="ns.e('icon')">
      <slot name="leading" />
    </span>
    <span :class="ns.e('label')"><slot /></span>
    <button
      v-if="closable"
      type="button"
      :class="ns.e('close')"
      :aria-label="closeLabel ?? t('tag.remove')"
      @click="emit('close', $event)"
    >
      <CloseIcon />
    </button>
  </span>
</template>
