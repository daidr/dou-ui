<template>
  <DouTabs v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size" model-value="a">
    <DouTabPanel value="a" :label="size" />
    <DouTabPanel value="b" label="部署" />
    <DouTabPanel value="c" label="设置" />
  </DouTabs>
</template>
