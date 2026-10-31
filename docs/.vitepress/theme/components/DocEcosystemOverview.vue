<script setup lang="ts">
import { withBase } from 'vitepress'
import { ecosystemArt } from '../overview-art'

/** The packages besides `dou-ui`, one card each. */
const groups = [
  {
    text: '组件包',
    items: [
      { key: 'editor', name: '块编辑器', label: '@dou-ui/editor', link: '/editor/' },
      { key: 'flow', name: '流程编辑器', label: '@dou-ui/flow', link: '/flow/' },
      { key: 'gantt', name: '甘特图', label: '@dou-ui/gantt', link: '/gantt/' },
      { key: 'sheet', name: '电子表格', label: '@dou-ui/sheet', link: '/sheet/' },
      { key: 'chart', name: '图表', label: '@dou-ui/chart', link: '/chart/' },
      {
        key: 'form-builder',
        name: '表单设计器',
        label: '@dou-ui/form-builder',
        link: '/form-builder/',
      },
      { key: 'code', name: '代码编辑器', label: '@dou-ui/code', link: '/code/' },
      { key: 'pivot', name: '数据透视', label: '@dou-ui/pivot', link: '/pivot/' },
    ],
  },
  {
    text: '配套包',
    items: [
      { key: 'icons', name: '图标库', label: '@dou-ui/icons', link: '/icons/' },
      { key: 'nuxt', name: 'Nuxt 模块', label: '@dou-ui/nuxt', link: '/integrations/nuxt' },
    ],
  },
].map((group) => ({
  ...group,
  items: group.items.map((item) => ({ ...item, art: ecosystemArt(item.key) })),
}))
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
          <a class="doc-overview__card" :href="withBase(item.link)" :data-art="item.key">
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
