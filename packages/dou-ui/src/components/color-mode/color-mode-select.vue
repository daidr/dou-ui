<script setup lang="ts">
import { MonitorIcon, MoonIcon, SunIcon } from '@dou-ui/icons'
import { computed, onMounted, ref } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import DouSelect from '../select/select.vue'
import type { SelectValue } from '../select/select'
import { useColorMode } from './use-color-mode'
import type { ColorMode, ColorModeSelectProps } from './color-mode'

defineOptions({ name: 'DouColorModeSelect' })

defineProps<ColorModeSelectProps>()

const ns = useNamespace('color-mode-select')
const { t } = useLocale()
const { mode } = useColorMode()

const icons = { light: SunIcon, dark: MoonIcon, system: MonitorIcon }
const options = computed(() =>
  (['light', 'dark', 'system'] as const).map((value) => ({
    value,
    label: t(`colorMode.${value}`),
  })),
)

// The server renders the initial mode; the browser's choice shows once mounted.
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const shown = computed<ColorMode | undefined>(() => (mounted.value ? mode.value : undefined))

function onChange(value: SelectValue | SelectValue[] | null | undefined) {
  if (value === 'light' || value === 'dark' || value === 'system') mode.value = value
}
</script>

<template>
  <DouSelect
    :class="ns.b()"
    :model-value="shown"
    :options="options"
    :size="size"
    :disabled="disabled"
    :placeholder="t('colorMode.label')"
    :aria-label="t('colorMode.label')"
    @update:model-value="onChange"
  >
    <template #prefix>
      <component :is="icons[shown ?? 'system']" :class="ns.e('icon')" />
    </template>
    <template #option="{ option }">
      <span :class="ns.e('option')">
        <component :is="icons[option.value as ColorMode]" :class="ns.e('icon')" />
        {{ option.label }}
      </span>
    </template>
  </DouSelect>
</template>
