<script setup>
import { useIntersection } from 'dou-ui'
import { useTemplateRef } from 'vue'

const scroller = useTemplateRef('scroller')
const target = useTemplateRef('target')
const { isIntersecting, ratio } = useIntersection(target, {
  root: scroller,
  threshold: [0, 0.5, 1],
})
</script>

<template>
  <div class="wrap">
    <DouText variant="secondary">
      {{ isIntersecting ? `可见 ${Math.round(ratio * 100)}%` : '不可见' }}
    </DouText>
    <div ref="scroller" class="scroller">
      <DouText variant="tertiary" size="sm">向下滚动</DouText>
      <div ref="target" class="target" :class="{ 'is-visible': isIntersecting }">目标</div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 320px;
}
.scroller {
  height: 120px;
  padding: 12px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  overflow: auto;
}
.target {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  margin-top: 160px;
  margin-bottom: 40px;
  border-radius: var(--dou-radius-control);
  background-color: var(--dou-color-bg-muted);
  color: var(--dou-color-text-secondary);
  transition: background-color var(--dou-motion-duration-fast) var(--dou-motion-easing);
}
.target.is-visible {
  background-color: color-mix(in oklab, var(--dou-color-text) 12%, transparent);
  color: var(--dou-color-text);
}
</style>
