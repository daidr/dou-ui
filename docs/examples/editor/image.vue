<script setup lang="ts">
import { DouEditor, image, starterKit } from '@dou-ui/editor'
import { ref } from 'vue'

// 示例里只在本地显示，实际使用时把文件上传到自己的存储，返回图片地址
const upload = async (file: File) => {
  await new Promise((resolve) => setTimeout(resolve, 1200))
  return URL.createObjectURL(file)
}

const extensions = [starterKit(), image({ upload })]

const photo =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">' +
      '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#cfd8e3"/><stop offset="1" stop-color="#eef1f4"/></linearGradient></defs>' +
      '<rect width="960" height="540" fill="url(#s)"/>' +
      '<path d="M0 400 L120 330 L220 360 L330 250 L420 320 L520 200 L600 290 L700 230 L820 300 L960 260 L960 540 L0 540Z" fill="#8a97a8"/>' +
      '<path d="M0 450 L160 400 L300 430 L460 380 L620 420 L780 390 L960 420 L960 540 L0 540Z" fill="#5f6b7a"/>' +
      '</svg>',
  )

const blocks = ref([
  { type: 'heading', props: { level: 2 }, content: '周末去崇明' },
  { type: 'paragraph', content: '戴兜拍的东滩傍晚，拖动图片两侧可以调整宽度。' },
  { type: 'image', props: { src: photo, caption: '东滩湿地', width: 70 } },
  { type: 'paragraph', content: '' },
])
</script>

<template>
  <DouEditor v-model="blocks" :extensions="extensions" label="游记" />
</template>
