<script setup lang="ts">
import { breakpoints, useBreakpoints } from 'dou-ui'

const screen = useBreakpoints()
const names = Object.keys(breakpoints) as (keyof typeof breakpoints)[]
</script>

<template>
  <div class="breakpoints-demo">
    <DouText>
      当前断点：<DouTag>{{ screen.current }}</DouTag>
    </DouText>
    <div class="breakpoints-demo__flags">
      <DouTag v-for="name in names" :key="name" :tone="screen[name] ? 'success' : 'neutral'">
        {{ name }} ≥ {{ breakpoints[name] }}px：{{ screen[name] ? '是' : '否' }}
      </DouTag>
    </div>
    <DouText size="sm" variant="tertiary">调整窗口宽度，数值会跟着变化。</DouText>
  </div>
</template>

<style scoped>
.breakpoints-demo {
  display: grid;
  gap: 12px;
}

.breakpoints-demo__flags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
