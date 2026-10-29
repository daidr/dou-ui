<script setup>
import { ref } from 'vue'

const files = ref([])
</script>

<template>
  <DouUpload
    v-model="files"
    directory
    dropzone
    hint="选择或拖入一个文件夹，列表显示文件在文件夹里的路径"
  />
</template>
