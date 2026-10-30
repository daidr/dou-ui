<script setup>
import { DouEditor } from '@dou-ui/editor'
import { computed, ref } from 'vue'

const blocks = ref([
  { id: 'title', type: 'heading', props: { level: 3 }, content: '采购清单' },
  {
    id: 'coffee',
    type: 'bulletItem',
    content: [
      { type: 'text', text: '咖啡豆' },
      { type: 'text', text: '两包', marks: ['bold'] },
    ],
  },
])

const json = computed(() => JSON.stringify(blocks.value, null, 2))
</script>

<template>
  <DouEditor v-model="blocks" label="采购清单" />
  <DouCodeBlock :code="json" lang="json" :max-lines="16" />
</template>
