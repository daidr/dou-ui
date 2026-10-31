<script setup>
import { DouCodeEditor, typescript } from '@dou-ui/code'
import { DouButton, DouSpace, DouSwitch } from 'dou-ui'
import { ref } from 'vue'

const code =
  ref(`// 戴兜的咖啡订单：按门店汇总杯数，再挑出今天需要补货的门店，补货单会在每天下午三点自动发给上海仓库的值班同事
interface Store {
  id: string
  city: string
  orders: Array<{ owner: string; cups: number; note?: string }>
}

const stores: Store[] = [
  {
    id: 'sh-001',
    city: '上海',
    orders: [
      { owner: '戴兜', cups: 2, note: '少冰，燕麦奶换成全脂牛奶，第二杯请晚十分钟再做，取餐时会打电话' },
      { owner: '阿青', cups: 1 },
    ],
  },
]

export function restock(list: Store[], limit = 3) {
  return list
    .map((store) => ({
      id: store.id,
      cups: store.orders.reduce((sum, order) => sum + order.cups, 0),
    }))
    .filter((store) => store.cups >= limit)
}
`)
const wrap = ref(true)
const editor = ref()
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouSpace align="center" wrap>
      <DouSwitch v-model="wrap">自动换行</DouSwitch>
      <DouButton size="sm" @click="editor.foldAll()">全部折叠</DouButton>
      <DouButton size="sm" @click="editor.unfoldAll()">全部展开</DouButton>
    </DouSpace>
    <DouCodeEditor
      ref="editor"
      v-model="code"
      :language="typescript"
      :wrap="wrap"
      aria-label="换行与折叠示例"
    />
  </DouSpace>
</template>
