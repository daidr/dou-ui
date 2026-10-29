<script setup lang="ts">
const slides = [
  { title: '第 19 批组件', text: '水印、轮播与漫游引导上线', tone: 'primary' },
  { title: '图标扩充', text: '七百多个线条图标，统一线宽', tone: 'success' },
  { title: '主题生成', text: '一个品牌色生成亮暗两套主题', tone: 'warning' },
  { title: '组合式函数', text: '用内置浮层的方式写自己的组件', tone: 'danger' },
]
</script>

<template>
  <DouCarousel style="width: 100%">
    <DouCarouselItem v-for="slide in slides" :key="slide.title">
      <div class="carousel-demo-slide" :style="{ '--tone': `var(--dou-color-${slide.tone})` }">
        <strong>{{ slide.title }}</strong>
        <span>{{ slide.text }}</span>
      </div>
    </DouCarouselItem>
  </DouCarousel>
</template>

<style scoped>
.carousel-demo-slide {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  height: 200px;
  padding: 0 64px;
  background: linear-gradient(
    135deg,
    color-mix(in oklab, var(--tone) 18%, var(--dou-color-bg-surface)),
    color-mix(in oklab, var(--tone) 6%, var(--dou-color-bg-surface))
  );
  color: var(--dou-color-text);

  & strong {
    font-size: 20px;
    font-weight: 600;
  }

  & span {
    color: var(--dou-color-text-secondary);
  }
}
</style>
