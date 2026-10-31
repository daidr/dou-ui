<script setup>
import { DouCodeEditor, DouCodeKeys, typescript } from '@dou-ui/code'
import { ref } from 'vue'

const code = ref(`// 戴兜的待办：每天早上整理一次
const todos = [
  { title: '给阿青回消息', done: false },
  { title: '订上海周五的会议室', done: true },
]

export const left = todos.filter((todo) => !todo.done).length
`)
const editor = ref()
</script>

<template>
  <div class="touch-demo">
    <DouCodeEditor ref="editor" v-model="code" :language="typescript" aria-label="触屏示例" />
    <!-- 触屏上编辑器自带的符号栏会贴在键盘上方，这里只在桌面上显示一条 -->
    <DouCodeKeys class="touch-demo__keys" :editor="editor" />
  </div>
</template>

<style scoped>
.touch-demo {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--dou-radius-container);
}
@media (pointer: coarse) {
  .touch-demo__keys {
    display: none;
  }
}
</style>
