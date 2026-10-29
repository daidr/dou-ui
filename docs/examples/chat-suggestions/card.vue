<script setup>
import { CodeIcon, MailIcon, MapIcon, PenSparkleIcon } from '@dou-ui/icons'

const items = [
  { value: 'mail', label: '写邮件', description: '给团队发一封项目进度更新', icon: MailIcon },
  { value: 'trip', label: '规划行程', description: '安排一个上海周末一日游', icon: MapIcon },
  { value: 'code', label: '解释代码', description: '逐行说明一段函数在做什么', icon: CodeIcon },
  { value: 'polish', label: '润色文字', description: '让一段话读起来更通顺', icon: PenSparkleIcon },
]
</script>

<template>
  <DouChatSuggestions variant="card" :columns="2" :items="items" />
</template>
