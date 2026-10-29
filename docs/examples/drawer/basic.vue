<script setup>
import { ref } from 'vue'

const open = ref(false)
const placement = ref('right')
const show = (value) => {
  placement.value = value
  open.value = true
}
</script>

<template>
  <DouButton
    v-for="value in ['right', 'left', 'top', 'bottom']"
    :key="value"
    variant="outline"
    @click="show(value)"
  >
    {{ value }}
  </DouButton>
  <DouDrawer v-model:open="open" :placement="placement" title="部署详情">
    <DouSpace direction="vertical" block>
      <DouText variant="secondary">main · 39dc86b，3 分钟前由戴兜触发。</DouText>
      <DouText variant="secondary">构建耗时 42 秒，产物 1.2 MB，已分发到 18 个节点。</DouText>
    </DouSpace>
    <template #footer="{ close }">
      <DouButton variant="outline" @click="close">关闭</DouButton>
      <DouButton @click="close">访问</DouButton>
    </template>
  </DouDrawer>
</template>
