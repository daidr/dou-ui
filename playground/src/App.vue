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
      <DouButton variant="outline" size="sm" @click="theme = theme === 'light' ? 'dark' : 'light'">
        {{ theme === 'light' ? '深色' : '浅色' }}
      </DouButton>
    </header>

    <section>
      <h2>composition</h2>
      <article class="card">
        <div class="card__body">
          <p class="card__eyebrow">Production</p>
          <h3 class="card__title">dou-ui.dev</h3>
          <p class="card__desc">最近一次部署于 3 分钟前完成，所有检查均已通过。</p>
        </div>
        <footer class="card__footer">
          <span class="card__meta">main · 39dc86b</span>
          <div class="row">
            <DouButton variant="ghost" size="sm">日志</DouButton>
            <DouButton variant="outline" size="sm">回滚</DouButton>
            <DouButton size="sm">访问</DouButton>
          </div>
        </footer>
      </article>
    </section>

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
        <DouButton v-for="size in sizes" :key="size" :size="size">
          {{ size }}
        </DouButton>
      </div>
    </section>

    <section>
      <h2>loading</h2>
      <div class="row">
        <DouButton :loading="loading" @click="simulate">
          {{ loading ? '提交中…' : '点击提交' }}
        </DouButton>
      </div>
    </section>

    <section>
      <h2>block</h2>
      <DouButton block>block</DouButton>
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
.card {
  max-width: 480px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-surface);
  box-shadow: var(--dou-shadow-md);
  overflow: hidden;
}
.card__body {
  padding: 20px 24px;
}
.card__eyebrow {
  margin: 0;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
.card__title {
  margin: 4px 0 6px;
  font-size: var(--dou-font-size-lg);
  font-weight: var(--dou-font-weight-bold);
}
.card__desc {
  margin: 0;
  color: var(--dou-color-text-secondary);
}
.card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-top: 1px solid var(--dou-color-border-subtle);
  background: var(--dou-color-bg-canvas);
}
.card__meta {
  color: var(--dou-color-text-tertiary);
  font-family: var(--dou-font-family-mono);
  font-size: var(--dou-font-size-sm);
}
h1 {
  margin: 0;
  font-size: 24px;
  font-weight: var(--dou-font-weight-bold);
  letter-spacing: -0.02em;
}
h2 {
  margin: 32px 0 12px;
  color: var(--dou-color-text-tertiary);
  font-family: var(--dou-font-family-mono);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-regular);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
