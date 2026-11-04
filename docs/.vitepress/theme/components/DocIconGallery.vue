<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
import type { Component } from 'vue'
import * as exports from '@dou-ui/icons'
import { SearchIcon } from '@dou-ui/icons'
import { categories, icons } from '@dou-ui/icons/meta'
import type { IconCategory, IconMeta } from '@dou-ui/icons/meta'

const registry: Record<string, Component> = { ...exports }
const iconOf = (meta: IconMeta) => registry[meta.component]!

const query = ref('')
/** One drawing at every size: the slider only previews it. */
const size = ref(24)
const category = ref<IconCategory | 'all'>('all')
const counts = computed(() => {
  const map = new Map<string, number>()
  for (const icon of icons) {
    for (const key of icon.categories) map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
})
const filters = computed(() => [
  { key: 'all' as const, label: '全部', count: icons.length },
  ...(Object.keys(categories) as IconCategory[])
    .filter((key) => counts.value.has(key))
    .map((key) => ({ key, label: categories[key], count: counts.value.get(key)! })),
])

/** Match the name, the component, the label or a category, in any case. */
const results = computed(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return icons.filter((icon) => {
    if (category.value !== 'all' && !icon.categories.includes(category.value)) return false
    const haystack = [
      icon.name,
      icon.component,
      icon.label,
      ...icon.categories.flatMap((key) => [key, categories[key]]),
    ]
      .join(' ')
      .toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
})

const active = shallowRef<IconMeta>()
const open = ref(false)
function show(icon: IconMeta) {
  active.value = icon
  open.value = true
}

const preview = useTemplateRef<HTMLElement>('preview')
/** The drawing as a standalone file, with the default line width. */
function svgSource() {
  const svg = preview.value?.querySelector('svg')?.cloneNode(true) as SVGElement | undefined
  if (!svg) return ''
  for (const name of ['width', 'height', 'aria-hidden', 'role', 'aria-label']) {
    svg.removeAttribute(name)
  }
  svg.removeAttribute('style')
  svg.setAttribute('stroke-width', '1.5')
  for (const shape of svg.querySelectorAll('*')) {
    shape.removeAttribute('vector-effect')
    shape.removeAttribute('style')
    // dots are a little heavier than lines
    if (shape.getAttribute('d')?.endsWith('h.01')) shape.setAttribute('stroke-width', '2.25')
  }
  return svg.outerHTML
    .replace(/<!--.*?-->/g, '')
    .replace(/></g, '>\n  <')
    .replace(/\n {2}<\/svg>/, '\n</svg>')
}
</script>

<template>
  <div class="icon-gallery dou-not-prose">
    <div class="icon-gallery__toolbar">
      <DouInput
        v-model="query"
        class="icon-gallery__search"
        clearable
        placeholder="搜索名称、中文或分类"
      >
        <template #prefix
          ><DouIcon><SearchIcon /></DouIcon
        ></template>
      </DouInput>
      <label class="icon-gallery__size">
        <span>尺寸 {{ size }}px</span>
        <DouSlider v-model="size" :min="12" :max="64" :step="2" size="sm" />
      </label>
    </div>

    <div class="icon-gallery__filters" role="group" aria-label="分类">
      <DouButton
        v-for="item in filters"
        :key="item.key"
        size="sm"
        :variant="category === item.key ? 'soft' : 'ghost'"
        :aria-pressed="category === item.key"
        @click="category = item.key"
      >
        {{ item.label }}
        <span class="icon-gallery__count">{{ item.count }}</span>
      </DouButton>
    </div>

    <p class="icon-gallery__summary" aria-live="polite">共 {{ results.length }} 个图标</p>

    <ul v-if="results.length" class="icon-gallery__grid" :style="{ '--icon-size': `${size}px` }">
      <li v-for="icon in results" :key="icon.component">
        <button type="button" class="icon-gallery__cell" :title="icon.label" @click="show(icon)">
          <component :is="iconOf(icon)" :size="size" />
          <span class="icon-gallery__name">{{ icon.name }}</span>
        </button>
      </li>
    </ul>
    <DouEmpty v-else title="没有找到图标" description="换个关键词，或者切回“全部”分类试试。" />

    <DouDialog v-model:open="open" :title="active?.component" width="480px">
      <div v-if="active" class="icon-detail">
        <div ref="preview" class="icon-detail__preview">
          <component :is="iconOf(active)" :size="96" />
        </div>
        <div class="icon-detail__sizes">
          <component :is="iconOf(active)" v-for="n in [16, 24, 32, 48]" :key="n" :size="n" />
        </div>
        <DouDescriptions :columns="1" layout="horizontal" label-width="72px" variant="table">
          <DouDescriptionsItem label="名称">{{ active.name }}</DouDescriptionsItem>
          <DouDescriptionsItem label="标签">{{ active.label }}</DouDescriptionsItem>
          <DouDescriptionsItem label="分类">
            <span class="icon-detail__tags">
              <DouTag v-for="key in active.categories" :key="key" size="sm">{{
                categories[key]
              }}</DouTag>
            </span>
          </DouDescriptionsItem>
          <DouDescriptionsItem label="变体">{{ active.variant }}</DouDescriptionsItem>
        </DouDescriptions>
        <div class="icon-detail__snippets">
          <div class="icon-detail__snippet">
            <code>import { {{ active.component }} } from '@dou-ui/icons'</code>
            <DouCopyButton
              :text="`import { ${active.component} } from '@dou-ui/icons'`"
              size="sm"
            />
          </div>
          <div class="icon-detail__snippet">
            <code>&lt;{{ active.component }} /&gt;</code>
            <DouCopyButton :text="`<${active.component} />`" size="sm" />
          </div>
        </div>
      </div>
      <template #footer>
        <DouCopyButton :text="svgSource" variant="outline" show-label label="复制 SVG" />
      </template>
    </DouDialog>
  </div>
</template>
