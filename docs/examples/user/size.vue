<template>
  <DouUser
    v-for="size in ['sm', 'md', 'lg']"
    :key="size"
    :size="size"
    name="戴兜"
    description="前端工程师"
  />
</template>
