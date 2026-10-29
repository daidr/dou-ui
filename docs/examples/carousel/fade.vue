<template>
  <DouCarousel effect="fade" arrows="always" :loop="false" style="width: 100%">
    <DouCarouselItem v-for="n in 3" :key="n">
      <div class="carousel-demo-fade">步骤 {{ n }}</div>
    </DouCarouselItem>
  </DouCarousel>
</template>

<style scoped>
.carousel-demo-fade {
  display: grid;
  place-items: center;
  height: 160px;
  background-color: var(--dou-color-bg-muted);
  color: var(--dou-color-text-secondary);
  font-size: 18px;
}
</style>
