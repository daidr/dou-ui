<script setup>
import { CopyIcon, SearchIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const site = ref('ui.daidr.me')
const scope = ref('all')
const scopes = [
  { value: 'all', label: '全部' },
  { value: 'docs', label: '文档' },
  { value: 'issues', label: '议题' },
]
const keyword = ref('')
const amount = ref('128')
</script>

<template>
  <DouFieldGroup block>
    <DouFieldGroupText>https://</DouFieldGroupText>
    <DouInput v-model="site" />
    <DouButton variant="outline">
      <template #leading>
        <CopyIcon />
      </template>
      复制
    </DouButton>
  </DouFieldGroup>
  <DouFieldGroup block>
    <DouSelect v-model="scope" :options="scopes" style="flex: 0 0 96px" />
    <DouInput v-model="keyword" placeholder="搜索">
      <template #prefix>
        <SearchIcon />
      </template>
    </DouInput>
    <DouButton tone="primary">搜索</DouButton>
  </DouFieldGroup>
  <DouFieldGroup block>
    <DouInput v-model="amount" />
    <DouFieldGroupText>元 / 月</DouFieldGroupText>
  </DouFieldGroup>
</template>
