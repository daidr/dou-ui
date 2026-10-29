<script setup lang="ts">
import { useRouter } from 'vitepress'
import { computed } from 'vue'
import type { CommandItem } from 'dou-ui'
import { useDocs } from '../use-docs'

const open = defineModel<boolean>('open', { default: false })
const router = useRouter()
const { allPages } = useDocs()

const items = computed<CommandItem[]>(() =>
  allPages.value.map((page) => ({
    value: page.link,
    label: page.text,
    group: page.group,
    keywords: [page.link.split('/').pop() ?? ''],
  })),
)
</script>

<template>
  <DouCommandDialog
    v-model:open="open"
    :items="items"
    hotkey="mod+k"
    placeholder="搜索组件和指南"
    aria-label="搜索文档"
    close-on-select
    @select="(item) => router.go(String(item.value))"
  />
</template>
