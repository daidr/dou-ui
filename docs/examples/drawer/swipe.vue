<script setup>
import { ref } from 'vue'

const open = ref(false)
const placement = ref('bottom')
const show = (value) => {
  placement.value = value
  open.value = true
}
</script>

<template>
  <DouButton
    v-for="value in ['bottom', 'right', 'top', 'left']"
    :key="value"
    variant="outline"
    @click="show(value)"
  >
    {{ value }}
  </DouButton>
  <DouDrawer v-model:open="open" :placement="placement" title="分享到" swipeable :size="280">
    <DouText variant="secondary"
      >在手机上可以按住任意位置向边缘滑动关闭；用鼠标时拖动标题栏或把手。</DouText
    >
  </DouDrawer>
</template>
