<script setup>
import { DouTextarea } from 'dou-ui'

const props = defineModel({ type: Object, required: true })
</script>

<template>
  <DouTextarea
    :model-value="props.text"
    autosize
    aria-label="内容"
    @update:model-value="props = { ...props, text: $event }"
  />
</template>
