<script setup lang="ts">
import { useData, useRoute } from 'vitepress'
import { computed, ref, watch } from 'vue'
import DocFooterNav from './components/DocFooterNav.vue'
import DocHeader from './components/DocHeader.vue'
import DocHome from './components/DocHome.vue'
import DocNotFound from './components/DocNotFound.vue'
import DocOutline from './components/DocOutline.vue'
import DocSearch from './components/DocSearch.vue'
import DocSidebar from './components/DocSidebar.vue'
import { useDocs } from './use-docs'

const { frontmatter, page } = useData()
const route = useRoute()
const { sidebar } = useDocs()

const isHome = computed(() => frontmatter.value.layout === 'home')
const hasSidebar = computed(
  () => !isHome.value && !page.value.isNotFound && sidebar.value.length > 0,
)

const searching = ref(false)
const drawer = ref(false)
watch(
  () => route.path,
  () => (drawer.value = false),
)
</script>

<template>
  <div class="doc-layout" :class="{ 'has-sidebar': hasSidebar }">
    <DouLink class="doc-skip" href="#main">跳到正文</DouLink>
    <DocHeader :has-sidebar="hasSidebar" @search="searching = true" @menu="drawer = true" />
    <DocNotFound v-if="page.isNotFound" />
    <DocHome v-else-if="isHome" />
    <div v-else class="doc-body">
      <aside v-if="hasSidebar" class="doc-body__sidebar">
        <DocSidebar />
      </aside>
      <main id="main" class="doc-body__main" tabindex="-1">
        <Content class="doc-content dou-prose" />
        <DocFooterNav />
      </main>
      <DocOutline class="doc-body__outline" />
    </div>
    <DocSearch v-model:open="searching" />
    <DouDrawer v-model:open="drawer" placement="left" size="288px" title="目录">
      <DocSidebar @navigate="drawer = false" />
    </DouDrawer>
  </div>
</template>
