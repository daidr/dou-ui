<script setup>
const first = ['Vue 3', 'TypeScript', '服务端渲染', '暗色模式', '按需引入', '无障碍']
const second = ['主题 Token', '表单校验', '虚拟列表', '国际化', '浮层', '组合式函数']
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 12px; width: 100%">
    <DouMarquee :speed="30" :gap="8">
      <DouTag v-for="tag in first" :key="tag">{{ tag }}</DouTag>
    </DouMarquee>
    <DouMarquee :speed="30" :gap="8" reverse>
      <DouTag v-for="tag in second" :key="tag">{{ tag }}</DouTag>
    </DouMarquee>
  </div>
</template>
