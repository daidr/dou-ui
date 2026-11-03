<script setup lang="ts">
import { computed } from 'vue'
import { useDocs } from '../use-docs'

const { path, release } = useDocs()

// `from=next` lets the stable site explain a page it does not have yet.
const stablePage = computed(() =>
  release.value
    ? `${release.value.sites.stable}${path.value === '/' ? '/' : path.value}?from=next`
    : '',
)
</script>

<template>
  <DouBanner v-if="release?.channel === 'next'" class="doc-channel-banner" tone="warning" show-icon>
    这是开发版文档，跟随主分支更新，可能包含尚未发布的功能。
    <template #action>
      <DouLink :href="stablePage">查看正式版文档</DouLink>
    </template>
  </DouBanner>
</template>
