<script setup>
import { CodeIcon, MailIcon, MapIcon, PenSparkleIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const text = ref('')
const items = [
  { label: '写邮件', description: '给团队发一封项目进度更新', icon: MailIcon },
  { label: '规划行程', description: '安排一个上海周末一日游', icon: MapIcon },
  { label: '解释代码', description: '逐行说明一段函数在做什么', icon: CodeIcon },
  { label: '润色文字', description: '让一段话读起来更通顺', icon: PenSparkleIcon },
]
</script>

<template>
  <div class="welcome">
    <h3 class="title">戴兜，今天想做点什么？</h3>
    <DouChatInput v-model="text" @submit="text = ''" />
    <DouChatSuggestions variant="card" :columns="2" :items="items" @select="text = $event" />
  </div>
</template>

<style scoped>
.welcome {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 560px;
  margin: 24px auto;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: var(--dou-font-weight-bold);
  text-align: center;
}
</style>
