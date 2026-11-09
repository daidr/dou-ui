<script setup lang="ts">
import { CloseIcon } from '@dou-ui/icons'
import { computed, ref, useAttrs, useTemplateRef } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { SlotNodes, filled } from '../../utils/slot'
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

// A label cut short by the ellipsis shows the whole text on hover. Measured
// only when the pointer arrives, so a page of tags costs nothing until then.
// A `title` given to the tag is the user's own and always wins.
const attrs = useAttrs()
const labelRef = useTemplateRef<HTMLElement>('label')
const labelTitle = ref<string>()
function onLabelEnter() {
  const el = labelRef.value
  if (!el || attrs.title != null) {
    labelTitle.value = undefined
    return
  }
  labelTitle.value =
    el.scrollWidth > el.clientWidth ? el.textContent?.trim() || undefined : undefined
}

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
    <!-- rendered once: a leading slot that renders nothing leaves no icon -->
    <template v-for="leading in [filled(slots.leading)]" :key="0">
      <span v-if="leading" :class="ns.e('icon')"><SlotNodes :nodes="leading" /></span>
    </template>
    <span ref="label" :class="ns.e('label')" :title="labelTitle" @pointerenter="onLabelEnter">
      <slot />
    </span>
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
