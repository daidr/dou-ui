<script setup>
import { nextTick, useId, useTemplateRef } from 'vue'

const descriptionId = useId()
const ok = useTemplateRef('ok')

// 打开时把焦点移到“知道了”，读屏会读出标题和说明
async function onOpen(open) {
  if (!open) return
  await nextTick()
  ok.value?.$el.focus()
}
</script>

<template>
  <DouPopover
    title="这次发布已无法撤销"
    :width="260"
    :aria-describedby="descriptionId"
    @update:open="onOpen"
  >
    <DouButton variant="outline">撤销发布</DouButton>
    <template #content="{ close }">
      <DouText :id="descriptionId" as="div" variant="secondary" size="sm">
        发布超过 24 小时后不能撤销，可以重新发布一个修正版本。
      </DouText>
      <DouSpace size="sm" justify="end" block style="margin-top: 12px">
        <DouButton ref="ok" size="sm" @click="close">知道了</DouButton>
      </DouSpace>
    </template>
  </DouPopover>
</template>
