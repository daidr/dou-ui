<script setup>
import { DouCodeEditor, json } from '@dou-ui/code'
import { DouButton, DouSegmentedControl, DouSpace } from 'dou-ui'
import { ref } from 'vue'

const sample = `{
  "city": "上海",
  "store": "sh-001",
  "owner": "戴兜",
  "openAt": "08:30"
}`
const code = ref(sample)
const state = ref('editable')
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
      <DouButton size="sm" @click="code = code ? '' : sample">
        {{ code ? '清空' : '恢复' }}
      </DouButton>
    </DouSpace>
    <DouCodeEditor
      v-model="code"
      :language="json"
      :readonly="state === 'readonly'"
      :disabled="state === 'disabled'"
      placeholder="填写门店配置"
      aria-label="门店配置"
    />
  </DouSpace>
</template>
