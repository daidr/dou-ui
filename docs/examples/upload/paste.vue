<script setup>
import { ref } from 'vue'

const images = ref([])
</script>

<template>
  <DouUpload
    v-model="images"
    dropzone
    multiple
    paste-target
    accept="image/*"
    hint="点一下这块区域，再粘贴截图"
  />
</template>
