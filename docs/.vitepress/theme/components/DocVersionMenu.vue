<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDownIcon } from '../icons'
import { useDocs } from '../use-docs'

const { path, release } = useDocs()

const label = computed(() =>
  release.value?.channel === 'stable' ? `v${release.value.version}` : '开发版',
)

const go = (url: string) => {
  window.location.href = url
}

/** The same page on the other site; see DocNotFound for pages it lacks. */
const pageOn = (channel: 'stable' | 'next') => {
  const info = release.value!
  const page = path.value === '/' ? '/' : path.value
  return `${info.sites[channel]}${page}${channel === 'stable' ? '?from=next' : ''}`
}

const pick = (channel: unknown) => {
  if (channel !== release.value?.channel) go(pageOn(channel as 'stable' | 'next'))
}
</script>

<template>
  <span v-if="release" class="doc-version-menu">
    <DouDropdown placement="bottom-end">
      <DouButton variant="ghost" size="sm" :aria-label="`文档版本：${label}`">
        {{ label }}
        <template #trailing
          ><DouIcon><ChevronDownIcon /></DouIcon
        ></template>
      </DouButton>
      <template #menu>
        <DouDropdownRadioGroup :model-value="release.channel" @update:model-value="pick">
          <DouDropdownItem value="stable">正式版文档</DouDropdownItem>
          <DouDropdownItem value="next">开发版文档</DouDropdownItem>
        </DouDropdownRadioGroup>
        <DouDropdownItem divided @click="go(release.changelog)">更新日志</DouDropdownItem>
      </template>
    </DouDropdown>
  </span>
</template>
