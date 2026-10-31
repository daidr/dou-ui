<script setup lang="ts">
import { useFormField } from '@dou-ui/form-builder'
import { DouCheckTag, DouCheckTagGroup } from 'dou-ui'

// 字段组件拿到 v-model 和描述里的 props
defineProps<{ options: string[] }>()
const model = defineModel<string | null>()

// 需要节点本身时（比如它的名字），用 useFormField()
const field = useFormField()
</script>

<template>
  <DouCheckTagGroup v-model="model" :aria-label="field.node.label">
    <DouCheckTag v-for="option in options" :key="option" :value="option">{{ option }}</DouCheckTag>
  </DouCheckTagGroup>
</template>
