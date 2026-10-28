<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import type { ButtonSize, ButtonTone, ButtonVariant } from 'dou-ui'

const variants: ButtonVariant[] = ['solid', 'soft', 'outline', 'ghost']
const tones: ButtonTone[] = ['neutral', 'primary', 'success', 'warning', 'danger']
const sizes: ButtonSize[] = ['sm', 'md', 'lg']

const theme = ref<'light' | 'dark'>('light')
const loading = ref(false)

watchEffect(() => {
  document.documentElement.dataset.douTheme = theme.value
})

function simulate() {
  loading.value = true
  setTimeout(() => (loading.value = false), 1500)
}
</script>

<template>
  <main class="page">
    <header class="row">
      <h1>DouUI Playground</h1>
      <DouButton variant="outline" @click="theme = theme === 'light' ? 'dark' : 'light'">
        {{ theme === 'light' ? '深色' : '浅色' }}
      </DouButton>
    </header>

    <section v-for="variant in variants" :key="variant">
      <h2>{{ variant }}</h2>
      <div class="row">
        <DouButton v-for="tone in tones" :key="tone" :variant="variant" :tone="tone">
          {{ tone }}
        </DouButton>
        <DouButton :variant="variant" tone="primary" disabled>disabled</DouButton>
      </div>
    </section>

    <section>
      <h2>size</h2>
      <div class="row">
        <DouButton v-for="size in sizes" :key="size" :size="size" tone="primary">
          {{ size }}
        </DouButton>
      </div>
    </section>

    <section>
      <h2>loading</h2>
      <div class="row">
        <DouButton tone="primary" :loading="loading" @click="simulate">
          {{ loading ? '提交中…' : '点击提交' }}
        </DouButton>
      </div>
    </section>

    <section>
      <h2>block</h2>
      <DouButton tone="primary" block>block</DouButton>
    </section>
  </main>
</template>

<style>
body {
  margin: 0;
}
.page {
  max-width: 880px;
  margin: 0 auto;
  padding: 32px 24px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
header.row {
  justify-content: space-between;
}
h2 {
  margin: 28px 0 12px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-md);
  font-weight: var(--dou-font-weight-medium);
}
</style>
