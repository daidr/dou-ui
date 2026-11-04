<script setup lang="ts">
import { DouEditor, type EditorDocument, type PartialBlock } from '@dou-ui/editor'
import { DouSegmentedControl } from 'dou-ui'
import { computed, ref } from 'vue'

const gap = ref('4px')
const width = ref('none')

const style = computed(() => ({
  '--dou-editor-block-gap': gap.value,
  '--dou-editor-reading-width': width.value,
}))

const doc = ref<EditorDocument<PartialBlock>>({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '上海办公室搬迁安排' },
    {
      content:
        '新办公室下月初启用，搬迁分两批进行。第一批是研发和设计，第二批是其余部门。每个人的工位号会在搬迁前一周发到邮箱。',
    },
    { content: '搬迁前请各自完成：' },
    { type: 'bulletItem', content: '把个人物品装进纸箱，贴好姓名和工位号' },
    { type: 'bulletItem', content: '显示器和主机由行政统一打包，不用自己拆' },
    { type: 'bulletItem', content: '离开前关掉工位上的所有电源' },
    { content: '有问题找戴兜，或者在行政群里提出。' },
  ],
})
</script>

<template>
  <div class="spacing-demo">
    <div class="spacing-demo__bar">
      <DouSegmentedControl
        v-model="gap"
        :options="[
          { value: '4px', label: '块间距 4px' },
          { value: '16px', label: '块间距 16px' },
        ]"
        size="sm"
      />
      <DouSegmentedControl
        v-model="width"
        :options="[
          { value: 'none', label: '占满宽度' },
          { value: '360px', label: '阅读宽度 360px' },
        ]"
        size="sm"
      />
    </div>
    <DouEditor v-model="doc" :style="style" aria-label="搬迁安排" />
  </div>
</template>

<style scoped>
.spacing-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spacing-demo__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
