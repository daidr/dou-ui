<script setup lang="ts">
import type { Component } from 'vue'
import { useData, useRouter } from 'vitepress'
import { ArrowRightIcon, CodeIcon, FocusIcon, LayersIcon } from '../icons'
import DocHeroWall from './DocHeroWall.vue'

interface HomeFrontmatter {
  hero?: {
    name?: string
    text?: string
    tagline?: string
    install?: string
    actions?: { theme?: 'brand' | 'alt'; text: string; link: string }[]
  }
  features?: { title: string; details: string; icon?: string }[]
}

const { frontmatter } = useData<unknown>()
const router = useRouter()
const home = () => frontmatter.value as HomeFrontmatter

const featureIcons: Record<string, Component> = {
  layers: LayersIcon,
  focus: FocusIcon,
  code: CodeIcon,
}
</script>

<template>
  <main class="doc-home">
    <section class="doc-hero">
      <DocHeroWall class="doc-hero__wall" />
      <div class="doc-hero__copy">
        <h1 class="doc-hero__name">{{ home().hero?.name }}</h1>
        <p class="doc-hero__text">{{ home().hero?.text }}</p>
        <p class="doc-hero__tagline">{{ home().hero?.tagline }}</p>
        <div class="doc-hero__actions">
          <DouButton
            v-for="action in home().hero?.actions"
            :key="action.link"
            :variant="action.theme === 'alt' ? 'outline' : 'solid'"
            size="lg"
            @click="router.go(action.link)"
          >
            {{ action.text }}
            <template v-if="action.theme !== 'alt'" #trailing
              ><DouIcon><ArrowRightIcon /></DouIcon
            ></template>
          </DouButton>
        </div>
        <div v-if="home().hero?.install" class="doc-hero__install">
          <span class="doc-hero__prompt" aria-hidden="true">$</span>
          <code>{{ home().hero?.install }}</code>
          <DouCopyButton :text="home().hero?.install" size="sm" />
        </div>
      </div>
    </section>
    <div class="doc-home__features">
      <section v-for="feature in home().features" :key="feature.title" class="doc-feature">
        <span v-if="feature.icon && featureIcons[feature.icon]" class="doc-feature__icon">
          <DouIcon><component :is="featureIcons[feature.icon]" /></DouIcon>
        </span>
        <h2 class="doc-feature__title">{{ feature.title }}</h2>
        <p class="doc-feature__details">{{ feature.details }}</p>
      </section>
    </div>
  </main>
</template>
