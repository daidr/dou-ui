<script setup>
import { FileTextIcon, TextSparkleIcon } from '@dou-ui/icons'
import { shallowRef } from 'vue'

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
const text = shallowRef('')
// 命令不多，直接给全，交给组件在本地匹配
const commands = [
  { value: 'summarize', label: '总结', keywords: ['summarize'], icon: TextSparkleIcon },
]
// 选项里带着图标组件，用 shallowRef，不要让 Vue 把组件变成响应式对象
const mentions = shallowRef([])
let request = 0
function search(query, trigger) {
  if (trigger !== '@') return
  const id = ++request
  setTimeout(() => {
    // 慢的请求可能后回来：只认最后一次查询的结果
    if (id !== request) return
    mentions.value = workspace
      .filter((path) => path.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
      .map((path) => ({ value: path, icon: FileTextIcon }))
  }, 300)
}
</script>

<template>
  <DouChatInput
    v-model="text"
    placeholder="输入 @ 搜索工作区里的文件，/ 选择命令"
    :commands="commands"
    :mentions="mentions"
    :filter="{ '@': false }"
    :search-delay="150"
    @search="search"
    @submit="text = ''"
  />
</template>
