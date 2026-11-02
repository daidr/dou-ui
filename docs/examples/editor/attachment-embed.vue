<script setup lang="ts">
import {
  attachment,
  DouEditor,
  editorKit,
  embed,
  image,
  type EditorDocument,
  type PartialBlock,
} from '@dou-ui/editor'
import { ref } from 'vue'

// 示例里只在本地保存，实际使用时把文件上传到自己的存储，返回文件地址
const upload = async (file: File) => {
  await new Promise((resolve) => setTimeout(resolve, 1200))
  return URL.createObjectURL(file)
}

const extensions = [editorKit(), image({ upload }), attachment({ upload }), embed()]

const plan =
  'data:text/plain;charset=utf-8,' +
  encodeURIComponent('上海滨江骑行路线：徐汇滨江 → 西岸美术馆 → 龙美术馆')

const doc = ref<EditorDocument<PartialBlock>>({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '滨江骑行' },
    { type: 'paragraph', content: '集合地点和路线都在下面，把文件拖进来可以添加附件。' },
    {
      type: 'embed',
      props: {
        src: 'https://www.openstreetmap.org/export/embed.html?bbox=121.452%2C31.168%2C121.478%2C31.190&layer=mapnik',
        caption: '徐汇滨江',
      },
    },
    {
      type: 'attachment',
      props: { src: plan, name: '骑行路线.txt', size: 75, mime: 'text/plain' },
    },
    { type: 'embed' },
  ],
})
</script>

<template>
  <DouEditor v-model="doc" :extensions="extensions" aria-label="活动安排" />
</template>
