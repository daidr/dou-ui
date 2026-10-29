<template>
  <DouTag size="sm">sm</DouTag>
  <DouTag>md</DouTag>
  <DouTag size="lg">lg</DouTag>
  <DouTag round tone="primary">12</DouTag>
  <DouTag round variant="outline">
    <template #leading>
      <span class="dot" />
    </template>
    运行中
  </DouTag>
</template>

<style scoped>
.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dou-color-success);
}
</style>
