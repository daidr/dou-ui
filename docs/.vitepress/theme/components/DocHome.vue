<script setup lang="ts">
import { useData, useRouter } from 'vitepress'

interface HomeFrontmatter {
  hero?: {
    name?: string
    text?: string
    tagline?: string
    actions?: { theme?: 'brand' | 'alt'; text: string; link: string }[]
  }
  features?: { title: string; details: string }[]
}

const { frontmatter } = useData<unknown>()
const router = useRouter()
const home = () => frontmatter.value as HomeFrontmatter
</script>

<template>
  <main class="doc-home">
    <section class="doc-home__hero">
      <h1 class="doc-home__name">{{ home().hero?.name }}</h1>
      <p class="doc-home__text">{{ home().hero?.text }}</p>
      <p class="doc-home__tagline">{{ home().hero?.tagline }}</p>
      <DouSpace class="doc-home__actions" :size="12">
        <DouButton
          v-for="action in home().hero?.actions"
          :key="action.link"
          :variant="action.theme === 'alt' ? 'outline' : 'solid'"
          size="lg"
          @click="router.go(action.link)"
        >
          {{ action.text }}
        </DouButton>
      </DouSpace>
    </section>
    <DouGrid class="doc-home__features" :cols="{ base: 1, md: 3 }" gap="md">
      <DouCard
        v-for="feature in home().features"
        :key="feature.title"
        :title="feature.title"
        :description="feature.details"
      />
    </DouGrid>
  </main>
</template>
