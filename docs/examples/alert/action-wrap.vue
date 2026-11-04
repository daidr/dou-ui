<script setup>
import { toast } from 'dou-ui'
import { ref } from 'vue'

const width = ref('300px')
const open = ref(true)

function answer(text) {
  open.value = false
  toast(text)
}
</script>

<template>
  <div class="alert-wrap-demo">
    <DouSegmentedControl
      v-model="width"
      :options="[
        { value: '200px', label: '200px' },
        { value: '300px', label: '300px' },
        { value: '460px', label: '460px' },
        { value: '100%', label: '100%' },
      ]"
    />
    <div :style="{ width, maxWidth: '100%' }">
      <DouAlert v-if="open" tone="primary" title="戴兜邀请你加入「上海门店巡检」">
        接受后可以查看并编辑这个项目的巡检计划。
        <template #action>
          <DouButton size="sm" variant="outline" @click="answer('已拒绝邀请')">拒绝</DouButton>
          <DouButton size="sm" variant="outline" @click="answer('明天再提醒你')">稍后</DouButton>
          <DouButton size="sm" tone="primary" @click="answer('已加入「上海门店巡检」')">
            接受
          </DouButton>
        </template>
      </DouAlert>
      <DouButton v-else size="sm" variant="outline" @click="open = true">重新显示</DouButton>
    </div>
  </div>
</template>

<style scoped>
.alert-wrap-demo {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
</style>
