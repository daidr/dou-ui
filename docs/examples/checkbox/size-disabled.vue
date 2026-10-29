<template>
  <DouCheckbox size="sm" :model-value="true">sm</DouCheckbox>
  <DouCheckbox :model-value="true">md</DouCheckbox>
  <DouCheckbox size="lg" :model-value="true">lg</DouCheckbox>
  <DouCheckbox disabled>禁用</DouCheckbox>
  <DouCheckbox disabled :model-value="true">禁用且选中</DouCheckbox>
</template>
