<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import DouSwitch from '../switch/switch.vue'
import { useColorMode } from './use-color-mode'
import type { ColorModeSwitchProps, ColorModeSwitchSlots } from './color-mode'

defineOptions({ name: 'DouColorModeSwitch' })

defineProps<ColorModeSwitchProps>()
const slots = defineSlots<ColorModeSwitchSlots>()

const ns = useNamespace('color-mode-switch')
const { t } = useLocale()
const { isDark } = useColorMode()

// Off on the server and in the first client render, then the real mode.
const mounted = ref(false)
onMounted(() => (mounted.value = true))
</script>

<template>
  <DouSwitch
    :class="ns.b()"
    :model-value="mounted && isDark"
    :size="size"
    :disabled="disabled"
    :aria-label="t('colorMode.dark')"
    @update:model-value="isDark = $event"
  >
    <template v-if="slots.default" #default><slot /></template>
  </DouSwitch>
</template>
