<script setup lang="ts">
import { MoonIcon, SunIcon } from '@dou-ui/icons'
import { onMounted, ref } from 'vue'
import { useNamespace } from '../../utils/namespace'
import DouButton from '../button/button.vue'
import { useLocale } from '../config-provider/use-config'
import { useColorMode } from './use-color-mode'
import type { ColorModeButtonProps } from './color-mode'

defineOptions({ name: 'DouColorModeButton' })

withDefaults(defineProps<ColorModeButtonProps>(), { variant: 'ghost' })

const ns = useNamespace('color-mode-button')
const { t } = useLocale()
const { isDark } = useColorMode()

// The server cannot know the mode, so the icon waits for the browser.
const mounted = ref(false)
onMounted(() => (mounted.value = true))
</script>

<template>
  <DouButton
    :class="[ns.b(), ns.is('pending', !mounted)]"
    :size="size"
    :variant="variant"
    :aria-label="t(mounted && isDark ? 'colorMode.toLight' : 'colorMode.toDark')"
    @click="isDark = !isDark"
  >
    <template #leading>
      <span :class="ns.e('icon')" aria-hidden="true">
        <MoonIcon v-if="mounted && isDark" />
        <SunIcon v-else-if="mounted" />
      </span>
    </template>
  </DouButton>
</template>
