<script setup lang="ts">
import { computed, ref } from 'vue'
import { createTheme, flattenTokens } from '@dou-ui/theme'
import { useColorMode } from 'dou-ui'

const brand = ref('#7c3aed')
const { isDark } = useColorMode()
const themes = computed(() => createTheme({ primary: brand.value }))
// only the generated colors, set on the preview so the rest of the page stays as it is
const vars = computed(() =>
  Object.fromEntries(
    flattenTokens(isDark.value ? themes.value.dark : themes.value.light).filter(
      ([name]) => name.startsWith('--dou-color-primary') || name === '--dou-color-focus',
    ),
  ),
)
const tone = computed(() => (isDark.value ? themes.value.dark : themes.value.light).color.primary)
const keys = ['DEFAULT', 'on', 'text', 'soft'] as const
const checked = ref(true)
</script>

<template>
  <div style="display: grid; gap: 16px; width: 100%">
    <DouSpace>
      <DouColorPicker v-model="brand" />
      <DouText variant="secondary" mono>
        <template v-for="(key, i) in keys" :key="key">
          <template v-if="i">· </template>
          <span style="white-space: nowrap">{{ key }} {{ tone[key] }}</span>
          {{ ' ' }}
        </template>
      </DouText>
    </DouSpace>
    <div :style="vars" style="display: grid; gap: 12px">
      <DouSpace wrap>
        <DouButton tone="primary">发布</DouButton>
        <DouButton tone="primary" variant="soft">预览</DouButton>
        <DouButton tone="primary" variant="outline">保存草稿</DouButton>
        <DouTag tone="primary">进行中</DouTag>
        <DouLink href="#" tone="primary">查看详情</DouLink>
        <DouSwitch v-model="checked" />
        <DouCheckbox v-model="checked">同步到团队</DouCheckbox>
      </DouSpace>
      <div
        style="
          padding: var(--dou-space-sm) var(--dou-space-md);
          border-radius: var(--dou-radius-control);
          background: var(--dou-color-primary-soft);
          color: var(--dou-color-primary-text);
        "
      >
        等你确认：上海门店的周报
      </div>
      <DouProgress :value="64" tone="primary" show-value />
    </div>
  </div>
</template>
