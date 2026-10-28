<script setup lang="ts">
import { onContentUpdated } from 'vitepress'
import { shallowRef } from 'vue'
import type { AnchorItem } from 'dou-ui'

const items = shallowRef<AnchorItem[]>([])

/** Read the page's h2 and h3 headings, nesting each h3 under the h2 before it. */
function collect() {
  const list: AnchorItem[] = []
  for (const heading of document.querySelectorAll<HTMLElement>('.doc-content :is(h2, h3)[id]')) {
    const copy = heading.cloneNode(true) as HTMLElement
    copy.querySelectorAll('.header-anchor').forEach((anchor) => anchor.remove())
    const item = { href: `#${heading.id}`, title: copy.textContent?.trim() ?? '' }
    const parent = list.at(-1)
    if (heading.tagName === 'H3' && parent) (parent.children ??= []).push(item)
    else list.push(item)
  }
  items.value = list
}
onContentUpdated(collect)
</script>

<template>
  <!-- `vp-raw` keeps the router from taking over the clicks, so the
       outline scrolls below the header and keeps its highlight steady. -->
  <aside v-if="items.length" class="doc-outline vp-raw">
    <p class="doc-outline__title">本页目录</p>
    <DouAnchor :items="items" :offset="88" />
  </aside>
</template>
