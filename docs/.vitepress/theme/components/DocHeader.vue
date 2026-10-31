<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, onMounted, ref } from 'vue'
import { useColorMode } from 'dou-ui'
import type { MenuOption } from 'dou-ui'
import { GithubIcon, MenuIcon, SearchIcon } from '../icons'
import { useDocs } from '../use-docs'

const emit = defineEmits<{ search: []; menu: [] }>()

const { site } = useData()
const { isDark } = useColorMode()
const { activeNav, nav, social } = useDocs()

const items = computed<MenuOption[]>(() =>
  nav.value.map((item) => ({ key: item.link, label: item.text, href: item.link })),
)
const github = computed(() => social.value.find((link) => link.icon === 'github')?.link)
// The server cannot know the reader's theme; follow it once mounted so
// hydration matches.
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const dark = computed(() => mounted.value && isDark.value)
const isMac = computed(() => mounted.value && /Mac|iPhone|iPad/.test(navigator.platform))
</script>

<template>
  <header class="doc-header">
    <div class="doc-header__inner">
      <DouButton
        class="doc-header__menu doc-icon-button"
        variant="ghost"
        aria-label="打开导航"
        @click="emit('menu')"
      >
        <template #leading
          ><DouIcon><MenuIcon /></DouIcon
        ></template>
      </DouButton>
      <a class="doc-header__logo" href="/">{{ site.title }}</a>
      <DouMenu class="doc-header__nav" mode="horizontal" :items="items" :model-value="activeNav" />
      <div class="doc-header__actions">
        <DouButton class="doc-header__search" variant="outline" size="sm" @click="emit('search')">
          <template #leading
            ><DouIcon><SearchIcon /></DouIcon
          ></template>
          搜索
          <template #trailing>
            <span class="doc-header__keys"
              ><DouKbd size="sm">{{ isMac ? '⌘' : 'Ctrl' }}</DouKbd
              ><DouKbd size="sm">K</DouKbd></span
            >
          </template>
        </DouButton>
        <DouTooltip :content="dark ? '切换到亮色' : '切换到暗色'">
          <DouColorModeButton class="doc-icon-button" />
        </DouTooltip>
        <a
          v-if="github"
          class="doc-icon-link"
          :href="github"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub 仓库"
        >
          <DouIcon :size="18"><GithubIcon /></DouIcon>
        </a>
      </div>
    </div>
  </header>
</template>
