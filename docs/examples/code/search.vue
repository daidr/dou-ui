<script setup>
import { DouCodeEditor, typescript } from '@dou-ui/code'
import { DouButton, DouSpace } from 'dou-ui'
import { ref } from 'vue'

const code = ref(`interface Order {
  id: string
  owner: string
  cups: number
}

const orders: Order[] = [
  { id: 'sh-001', owner: '戴兜', cups: 2 },
  { id: 'sh-002', owner: '阿青', cups: 1 },
  { id: 'sh-003', owner: '戴兜', cups: 3 },
]

const cupsOf = (owner: string) =>
  orders.filter((order) => order.owner === owner).reduce((sum, order) => sum + order.cups, 0)
`)
const editor = ref()
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouCodeEditor ref="editor" v-model="code" :language="typescript" aria-label="查找示例" />
    <DouSpace wrap>
      <DouButton size="sm" @click="editor.openSearch({ search: 'owner', wholeWord: true })">
        查找 owner
      </DouButton>
      <DouButton
        size="sm"
        @click="editor.openSearch({ search: `'sh-(\\d+)'`, regexp: true, replace: `'SH$1'` })"
      >
        用正则查找编号
      </DouButton>
    </DouSpace>
  </DouSpace>
</template>
