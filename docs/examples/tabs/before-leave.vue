<script setup>
import { ref } from 'vue'

const tab5 = ref('draft')
const saved = ref(false)
const confirmLeave = () => saved.value || window.confirm('草稿还没保存，确定离开吗？')
</script>

<template>
  <DouCheckbox v-model="saved">草稿已保存</DouCheckbox>
  <DouTabs v-model="tab5" :before-leave="confirmLeave">
    <DouTabPanel value="draft" label="草稿">还没保存的草稿。</DouTabPanel>
    <DouTabPanel value="preview" label="预览">预览效果。</DouTabPanel>
  </DouTabs>
</template>
