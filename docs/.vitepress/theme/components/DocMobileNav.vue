<script setup lang="ts">
import { computed } from 'vue'
import type { MenuOption } from 'dou-ui'
import { useDocs } from '../use-docs'
import DocSidebar from './DocSidebar.vue'
import DocVersionMenu from './DocVersionMenu.vue'

defineProps<{ hasSidebar: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
const { activeNav, nav } = useDocs()

const items = computed<MenuOption[]>(() =>
  nav.value.map((item) => ({ key: item.link, label: item.text, href: item.link })),
)
</script>

<template>
  <div class="doc-mobile-nav">
    <DocVersionMenu class="doc-mobile-nav__version" />
    <nav class="doc-mobile-nav__sections" aria-label="主导航">
      <DouMenu :items="items" :model-value="activeNav" @select="emit('navigate')" />
    </nav>
    <template v-if="hasSidebar">
      <DouDivider class="doc-mobile-nav__divider" />
      <DocSidebar @navigate="emit('navigate')" />
    </template>
  </div>
</template>
