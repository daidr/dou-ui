<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import type { MenuOption } from 'dou-ui'
import { normalize, useDocs } from '../use-docs'

const emit = defineEmits<{ navigate: [] }>()
const { path, sidebar } = useDocs()
const nav = useTemplateRef<HTMLElement>('nav')

// Open on a page far down the list with its entry in view.
onMounted(() => {
  const current = nav.value?.querySelector<HTMLElement>('[aria-current="page"], .is-selected')
  const box = nav.value?.parentElement
  if (!current || !box || box.scrollHeight <= box.clientHeight) return
  const offset = current.getBoundingClientRect().top - box.getBoundingClientRect().top
  box.scrollTop += offset - box.clientHeight / 3
})

const items = computed<MenuOption[]>(() =>
  sidebar.value.map((group) => ({
    type: 'group',
    label: group.text,
    children: group.items.map((item) => ({
      key: normalize(item.link),
      label: item.text,
      href: item.link,
    })),
  })),
)
</script>

<template>
  <nav ref="nav" class="doc-sidebar" aria-label="文档目录">
    <DouMenu :items="items" :model-value="path" @select="emit('navigate')" />
  </nav>
</template>
