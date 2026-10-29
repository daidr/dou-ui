<template>
  <DouRate
    v-for="size in ['sm', 'md', 'lg']"
    :key="size"
    :size="size"
    :model-value="3.5"
    allow-half
    readonly
  />
  <DouRate :model-value="2" disabled />
</template>
