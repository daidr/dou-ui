<script setup>
import { ref } from 'vue'

// a made-up folder tree: each folder and the folders in it
const tree = {
  '/': ['docs', 'packages', 'scripts'],
  '/docs': ['guide', 'components'],
  '/docs/guide': [],
  '/docs/components': [],
  '/packages': ['ui', 'theme', 'icons'],
  '/packages/ui': ['src', 'tests'],
  '/packages/ui/src': [],
  '/packages/ui/tests': [],
  '/packages/theme': ['src'],
  '/packages/theme/src': [],
  '/packages/icons': [],
  '/scripts': [],
}

const join = (folder, name) => (folder === '/' ? `/${name}` : `${folder}/${name}`)
const parentOf = (path) => path.slice(0, path.lastIndexOf('/')) || '/'

const path = ref('/')

// a folder lists what is in it, `..` first; part of a name lists the folders it starts
const folders = (query) => {
  const text = query || '/'
  if (text in tree) {
    const up = text === '/' ? [] : [{ value: parentOf(text), label: '..', description: '上一级' }]
    return [...up, ...tree[text].map((name) => ({ value: join(text, name), label: name }))]
  }
  const folder = parentOf(text)
  const start = text.slice(text.lastIndexOf('/') + 1)
  return (tree[folder] ?? [])
    .filter((name) => name.startsWith(start))
    .map((name) => ({ value: join(folder, name), label: name }))
}
</script>

<template>
  <DouAutocomplete
    v-model="path"
    :fetch="folders"
    :debounce="0"
    :filter="false"
    :highlight="false"
    :hide-on-select="false"
    placeholder="目录"
    style="width: 280px"
  >
    <template #empty>这个目录里没有子目录</template>
  </DouAutocomplete>
</template>
