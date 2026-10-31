<script setup lang="ts">
import { defineFormField, DouFormRenderer, type FormDocument } from '@dou-ui/form-builder'
import { reactive } from 'vue'
import ChipField from './chip-field.vue'

// 注册一个字段类型：用标签做单选
const chips = defineFormField<{ options: string[] }>({
  type: 'chips',
  component: ChipField,
  defaults: { options: [] },
  initial: (props) => props.options[0] ?? null,
})
const fields = [chips]

const document: FormDocument = {
  version: 1,
  nodes: [
    {
      id: 'size',
      type: 'chips',
      name: 'size',
      label: '杯型',
      props: { options: ['中杯', '大杯', '超大杯'] },
    },
    {
      id: 'sugar',
      type: 'chips',
      name: 'sugar',
      label: '甜度',
      props: { options: ['无糖', '三分', '五分', '全糖'] },
      default: '三分',
    },
  ],
}

const model = reactive<Record<string, string>>({})
</script>

<template>
  <DouFormRenderer :document="document" :fields="fields" :model="model" />
  <p>{{ model.size }} · {{ model.sugar }}</p>
</template>
