<script setup>
const big = Array.from({ length: 200 }, (_, i) => ({
  key: `g${i}`,
  label: `分组 ${i + 1}`,
  children: Array.from({ length: 50 }, (_item, j) => ({
    key: `g${i}-${j}`,
    label: `条目 ${i + 1}-${j + 1}`,
  })),
}))
</script>

<template>
  <DouTree :data="big" :height="280" guides aria-label="分组" />
</template>
