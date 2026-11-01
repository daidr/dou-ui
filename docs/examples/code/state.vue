<script setup>
import { DouCodeEditor, json } from '@dou-ui/code'
import { DouSegmentedControl, DouSpace, DouSwitch } from 'dou-ui'
import { ref } from 'vue'

const code = ref(`{
  "city": "上海",
  "store": "sh-001",
  "owner": "戴兜",
  "openAt": "08:30"
}
`)
const state = ref('editable')
const lineNumbers = ref(true)
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouSpace align="center" wrap>
      <DouSegmentedControl
        v-model="state"
        size="sm"
        :options="[
          { label: '可编辑', value: 'editable' },
          { label: '只读', value: 'readonly' },
          { label: '禁用', value: 'disabled' },
        ]"
      />
      <DouSwitch v-model="lineNumbers">行号</DouSwitch>
    </DouSpace>
    <DouCodeEditor
      v-model="code"
      :language="json"
      :readonly="state === 'readonly'"
      :disabled="state === 'disabled'"
      :line-numbers="lineNumbers"
      placeholder="填写门店配置"
      aria-label="门店配置"
    />
  </DouSpace>
</template>
