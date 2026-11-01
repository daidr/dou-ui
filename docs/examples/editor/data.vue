<script setup>
import { DouEditor } from '@dou-ui/editor'
import { computed, ref } from 'vue'

const doc = ref({
  version: 1,
  blocks: [
    { id: 'title', type: 'heading', props: { level: 3 }, content: '采购清单' },
    {
      id: 'coffee',
      type: 'bulletItem',
      content: [
        { type: 'text', text: '咖啡豆' },
        { type: 'text', text: '两包', marks: ['bold'] },
      ],
    },
  ],
})

const json = computed(() => JSON.stringify(doc.value, null, 2))
</script>

<template>
  <DouEditor v-model="doc" aria-label="采购清单" />
  <DouCodeBlock :code="json" lang="json" :max-lines="16" />
</template>
