<script setup>
import {
  FileCodeIcon,
  FileTextIcon,
  GlobeIcon,
  ListChecksIcon,
  MessageTextIcon,
  SettingsIcon,
  TextSparkleIcon,
  UserIcon,
} from '@dou-ui/icons'
import { ref } from 'vue'

const text = ref('')
const mode = ref(null)

const commands = [
  {
    value: 'summarize',
    label: '总结',
    keywords: ['summarize'],
    description: '提炼当前对话的核心结论、待办事项与未决问题，生成可直接转发的摘要',
    icon: TextSparkleIcon,
  },
  {
    value: 'translate',
    label: '翻译',
    keywords: ['translate'],
    description: '翻译上一条回复',
    icon: GlobeIcon,
  },
  {
    value: 'plan',
    label: 'grill-with-docs',
    keywords: ['plan'],
    description:
      'Interview the user relentlessly about a plan or design until reaching shared understanding',
    icon: ListChecksIcon,
  },
  {
    value: 'manage',
    label: '管理常用语',
    keywords: ['manage'],
    icon: SettingsIcon,
  },
]
const mentions = [
  {
    value: 'thread-zoom',
    label: '支持移动端图片浏览双指缩放',
    description: '讨论串',
    icon: MessageTextIcon,
  },
  {
    value: 'thread-ci',
    label: '修复 internal/local 路径规范化与 macOS/Windows CI 失败',
    description: '讨论串',
    icon: MessageTextIcon,
  },
  {
    value: 'ConversationPanel.vue',
    description: 'packages/web/src/components',
    icon: FileCodeIcon,
  },
  {
    value: '上海办公室搬迁：各部门工位分配与网络布线方案.md',
    description: 'docs/operations/shanghai-office-relocation/2026',
    icon: FileTextIcon,
  },
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
