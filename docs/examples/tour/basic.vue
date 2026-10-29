<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import type { TourStep } from 'dou-ui'

const open = ref(false)
const create = useTemplateRef<{ $el: HTMLElement }>('create')
const invite = useTemplateRef<{ $el: HTMLElement }>('invite')
const search = useTemplateRef<{ $el: HTMLElement }>('search')

const steps: TourStep[] = [
  {
    target: () => create.value?.$el,
    title: '新建项目',
    description: '项目是放置文档与任务的地方，先从这里建一个。',
  },
  {
    target: () => invite.value?.$el,
    title: '邀请成员',
    description: '把同事拉进来一起编辑，可以分别设置权限。',
    placement: 'bottom-end',
  },
  {
    target: () => search.value?.$el,
    title: '随时搜索',
    description: '按 ⌘K 在任何页面搜索项目、文档与命令。',
    placement: 'top',
  },
]
</script>

<template>
  <DouSpace direction="vertical" align="start">
    <DouSpace>
      <DouButton ref="create" tone="primary">新建项目</DouButton>
      <DouButton ref="invite" variant="outline">邀请成员</DouButton>
    </DouSpace>
    <DouInput ref="search" placeholder="搜索" style="width: 240px" />
    <DouButton variant="soft" @click="open = true">开始引导</DouButton>
  </DouSpace>
  <DouTour v-model:open="open" :steps="steps" />
</template>
