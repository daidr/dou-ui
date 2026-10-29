<script setup lang="ts">
import { computed } from 'vue'
import { splitHighlight } from '../../utils/highlight'
import { useNamespace } from '../../utils/namespace'
import type { HighlightProps, HighlightSlots } from './highlight'

defineOptions({ name: 'DouHighlight' })

const props = withDefaults(defineProps<HighlightProps>(), {
  text: '',
  caseSensitive: false,
  wholeWord: false,
})
defineSlots<HighlightSlots>()

const ns = useNamespace('highlight')

const parts = computed(() =>
  splitHighlight(props.text, props.keywords, {
    caseSensitive: props.caseSensitive,
    wholeWord: props.wholeWord,
  }),
)
</script>

<template>
  <span :class="ns.b()"
    ><template v-for="(part, index) in parts" :key="index"
      ><slot v-if="part.match" name="mark" :text="part.text"
        ><mark :class="ns.e('mark')">{{ part.text }}</mark></slot
      ><template v-else>{{ part.text }}</template></template
    ></span
  >
</template>
