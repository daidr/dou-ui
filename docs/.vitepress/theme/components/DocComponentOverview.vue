<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import type { SidebarGroup } from '../use-docs'
import { overviewArt } from '../overview-art'

const { theme } = useData<{ sidebar?: Record<string, SidebarGroup[]> }>()

/** The component sidebar, minus overview pages: one card per component page. */
const groups = computed(() =>
  (theme.value.sidebar?.['/components/'] ?? [])
    .map((group) => ({
      text: group.text,
      items: group.items.flatMap((item) => {
        const [name, ...label] = item.text.split(' ')
        if (!label.length) return []
        const slug = item.link.split('/').pop()!
        return [{ name: name!, label: label.join(' '), link: item.link, art: overviewArt(slug) }]
      }),
    }))
    .filter((group) => group.text && group.items.length),
)
</script>

<template>
  <div class="doc-overview">
    <section v-for="group in groups" :key="group.text" class="doc-overview__group">
      <h2 :id="group.text" class="doc-overview__title">
        {{ group.text }}
        <span class="doc-overview__count">{{ group.items.length }}</span>
      </h2>
      <ul class="doc-overview__grid dou-not-prose">
        <li v-for="item in group.items" :key="item.link">
          <a class="doc-overview__card" :href="withBase(item.link)">
            <svg
              class="doc-overview__art"
              viewBox="0 0 200 120"
              aria-hidden="true"
              focusable="false"
              v-html="item.art"
            />
            <span class="doc-overview__name">{{ item.name }}</span>
            <span class="doc-overview__label">{{ item.label }}</span>
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>
