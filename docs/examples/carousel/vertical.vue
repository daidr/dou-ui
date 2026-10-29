<template>
  <DouCarousel direction="vertical" height="160px" style="width: 100%">
    <DouCarouselItem v-for="n in 3" :key="n">
      <div class="carousel-demo-vertical">第 {{ n }} 屏</div>
    </DouCarouselItem>
  </DouCarousel>
</template>

<style scoped>
.carousel-demo-vertical {
  display: grid;
  place-items: center;
  height: 100%;
  background-color: var(--dou-color-bg-muted);
  color: var(--dou-color-text-secondary);
  font-size: 18px;
}
</style>
