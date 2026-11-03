<script setup lang="ts">
import { computed } from 'vue'
import type { ContextMenuItem } from 'dou-ui'
import { ChevronDownIcon } from '../icons'
import { useDocs } from '../use-docs'

const { path, release } = useDocs()

const label = computed(() =>
  release.value?.channel === 'stable' ? `v${release.value.version}` : '开发版',
)

const go = (url: string) => {
  window.location.href = url
}

// The same page on the other site, when it exists there.
const items = computed<ContextMenuItem[]>(() => {
  const info = release.value
  if (!info) return []
  const page = path.value === '/' ? '/' : path.value
  return [
    {
      key: 'stable',
      label: '正式版文档',
      checked: info.channel === 'stable',
      run: () => go(`${info.sites.stable}${page}`),
    },
    {
      key: 'next',
      label: '开发版文档',
      checked: info.channel === 'next',
      run: () => go(`${info.sites.next}${page}`),
    },
    { key: 'changelog', label: '更新日志', divided: true, run: () => go(info.changelog) },
  ]
})
</script>

<template>
  <span v-if="release" class="doc-version-menu">
    <DouDropdown :items="items" placement="bottom-end">
      <DouButton variant="ghost" size="sm" :aria-label="`文档版本：${label}`">
        {{ label }}
        <template #trailing
          ><DouIcon><ChevronDownIcon /></DouIcon
        ></template>
      </DouButton>
    </DouDropdown>
  </span>
</template>
