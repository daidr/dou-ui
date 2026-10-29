<script setup lang="ts">
import { computed } from 'vue'
import { formatHotkey, useApplePlatform } from '../../composables/use-hotkey'
import { useNamespace } from '../../utils/namespace'
import type { KbdProps, KbdSlots } from './kbd'

defineOptions({ name: 'DouKbd' })

const props = withDefaults(defineProps<KbdProps>(), { size: 'md' })
defineSlots<KbdSlots>()

const ns = useNamespace('kbd')
const apple = useApplePlatform()
const steps = computed(() => (props.keys ? formatHotkey(props.keys, apple.value) : []))
</script>

<template>
  <kbd v-if="keys" :class="[ns.b(), ns.m(size), ns.is('group')]"
    ><span v-for="(step, index) in steps" :key="index" :class="ns.e('step')"
      ><kbd v-for="key in step" :key="key" :class="[ns.b(), ns.m(size)]"
        ><span :class="ns.e('label')">{{ key }}</span></kbd
      ></span
    ></kbd
  >
  <kbd v-else :class="[ns.b(), ns.m(size)]"
    ><span :class="ns.e('label')"><slot /></span
  ></kbd>
</template>
