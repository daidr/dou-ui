<script setup>
import { DouCodeInput, defineCodeExtension, javascript } from '@dou-ui/code'
import { DouForm, DouFormItem } from 'dou-ui'
import { ref } from 'vue'

const form = ref({
  total: 'order.price * order.count',
  note: `order.city === '上海'
  ? '同城配送'
  : '快递'`,
})
const submitted = ref('')

// 订单上能读的字段，用来补全
const orderFields = [
  { label: 'price', detail: '单价' },
  { label: 'count', detail: '数量' },
  { label: 'city', detail: '城市' },
  { label: 'buyer', detail: '下单人，比如戴兜' },
]
const order = defineCodeExtension({
  name: 'order',
  completionTriggers: ['.'],
  completion({ word }, editor) {
    const afterDot = editor.doc.slice(word.from - 6, word.from) === 'order.'
    return {
      from: word.from,
      options: afterDot
        ? orderFields.map((field) => ({ ...field, kind: 'property' }))
        : [{ label: 'order', kind: 'variable', detail: '当前订单' }],
    }
  },
})
</script>

<template>
  <DouForm :model="form" label-width="88px" style="width: 100%; max-width: 520px">
    <DouFormItem label="合计" prop="total" help="按 Enter 提交">
      <DouCodeInput
        v-model="form.total"
        :language="javascript"
        :extensions="[order]"
        placeholder="输入 order. 看看补全"
        @enter="submitted = form.total"
      />
    </DouFormItem>
    <DouFormItem label="配送方式" prop="note">
      <DouCodeInput
        v-model="form.note"
        :language="javascript"
        :extensions="[order]"
        multiline
        :max-rows="4"
      />
    </DouFormItem>
    <p v-if="submitted" class="demo-submitted">已提交：{{ submitted }}</p>
  </DouForm>
</template>

<style scoped>
.demo-submitted {
  margin: 0;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
