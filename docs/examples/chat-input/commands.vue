<script setup>
import { FileTextIcon, GlobeIcon, ListChecksIcon, TextSparkleIcon, UserIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const text = ref('')
const mode = ref(null)

const commands = [
  { value: 'summarize', label: '总结', description: '概括对话要点', icon: TextSparkleIcon },
  { value: 'translate', label: '翻译', description: '翻译上一条回复', icon: GlobeIcon },
  { value: 'plan', label: '计划', description: '先列计划再动手', icon: ListChecksIcon },
]
const mentions = [
  { value: '需求文档.md', description: '文件', icon: FileTextIcon },
  { value: '会议记录.md', description: '文件', icon: FileTextIcon },
  { value: '戴兜', description: '成员', icon: UserIcon },
]
</script>

<template>
  <DouChatInput
    v-model="text"
    placeholder="输入 / 选择命令，输入 @ 引用文件或成员"
    :commands="commands"
    :mentions="mentions"
    @command="mode = $event"
    @submit="text = ''"
  >
    <template v-if="mode" #header>
      <DouTag closable @close="mode = null">{{ mode.label }}</DouTag>
    </template>
  </DouChatInput>
</template>
