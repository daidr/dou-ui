<script setup lang="ts">
import { DouEditor, editorKit } from '@dou-ui/editor'
import { codeEditorBlock } from '@dou-ui/editor/code'
import { ref } from 'vue'

const extensions = [editorKit({ codeBlock: codeEditorBlock() })]

const blocks = ref([
  { type: 'heading', props: { level: 2 }, content: '部署脚本' },
  {
    type: 'paragraph',
    content: '戴兜整理的发布步骤：先检查配置，再打包上传。',
  },
  {
    type: 'codeBlock',
    props: { language: 'yaml' },
    content: `service: shop-api
region: sh
replicas: 3
env:
  LOG_LEVEL: info`,
  },
  {
    type: 'codeBlock',
    props: { language: 'bash' },
    content: `set -e
bun run build
for host in sh-01 sh-02; do
  scp -r dist "$host:/srv/shop" # 上传到每台机器
done`,
  },
  { type: 'paragraph', content: '' },
])
</script>

<template>
  <DouEditor v-model="blocks" :extensions="extensions" aria-label="代码编辑器示例" />
</template>
