<script setup lang="ts">
import { computed } from 'vue'
import { cssVarName, dark, light } from '@dou-ui/theme'
import type { ThemeTokens } from '@dou-ui/theme'

const props = defineProps<{
  /** Which group of `color` tokens to show. */
  group: 'tone' | 'bg' | 'text' | 'border'
}>()

const tones = ['neutral', 'primary', 'success', 'warning', 'danger'] as const

interface Swatch {
  path: string
  light: string
  dark: string
}

const pick = (theme: ThemeTokens, path: string) =>
  path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], theme) as string

const swatches = computed<Swatch[]>(() => {
  const paths =
    props.group === 'tone'
      ? tones.map((tone) => `color.${tone}.DEFAULT`)
      : Object.keys(light.color[props.group]).map((key) => `color.${props.group}.${key}`)
  return paths.map((path) => ({ path, light: pick(light, path), dark: pick(dark, path) }))
})

const label = (path: string) => cssVarName(path).replace('--dou-color-', '')
</script>

<template>
  <div class="swatches">
    <div v-for="swatch in swatches" :key="swatch.path" class="swatch">
      <div class="swatch__chips">
        <span class="swatch__chip" :style="{ background: swatch.light }" />
        <span class="swatch__chip" :style="{ background: swatch.dark }" />
      </div>
      <div class="swatch__name">{{ label(swatch.path) }}</div>
      <div class="swatch__value">{{ swatch.light }} / {{ swatch.dark }}</div>
    </div>
  </div>
</template>

<style scoped>
.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  margin: 16px 0 24px;
}
.swatch__chips {
  display: flex;
  height: 56px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}
.swatch__chip {
  flex: 1;
}
.swatch__name {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 500;
}
.swatch__value {
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
}
</style>
