<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import type { MenuOption } from 'dou-ui'
import { normalize, useDocs } from '../use-docs'
import type { NavLink } from '../use-docs'

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

const entry = (item: NavLink): MenuOption => ({
  key: normalize(item.link),
  label: item.text,
  href: item.link,
})
// A group without a title (e.g. the overview) lists its pages on their own.
const items = computed<MenuOption[]>(() =>
  sidebar.value.flatMap((group) =>
    group.text
      ? [{ type: 'group', label: group.text, children: group.items.map(entry) }]
      : group.items.map(entry),
  ),
)
</script>

<template>
  <nav ref="nav" class="doc-sidebar" aria-label="文档目录">
    <DouMenu :items="items" :model-value="path" @select="emit('navigate')" />
  </nav>
</template>
