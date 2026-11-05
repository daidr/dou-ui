<script setup>
import { FileTextIcon } from '@dou-ui/icons'
import { ref } from 'vue'

// 假装这是服务端的工作区，文件多到不能一次全给组件
const workspace = [
  'docs/需求文档.md',
  'docs/会议记录.md',
  'docs/上线计划.md',
  'src/app.vue',
  'src/router.ts',
  'src/stores/user.ts',
  'src/views/home.vue',
  'src/views/settings.vue',
]
const text = ref('')
const mentions = ref([])
let request = 0
function search(query, trigger) {
  if (trigger !== '@') return
  const id = ++request
  setTimeout(() => {
    // 只认最后一次查询的结果
    if (id !== request) return
    mentions.value = workspace
      .filter((path) => path.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
      .map((path) => ({
        value: path,
        label: path.split('/').pop(),
        description: path,
        icon: FileTextIcon,
      }))
  }, 300)
}
</script>

<template>
  <DouChatInput
    v-model="text"
    placeholder="输入 @ 搜索工作区里的文件"
    :mentions="mentions"
    :filter="false"
    :search-delay="150"
    @search="search"
    @submit="text = ''"
  />
</template>
