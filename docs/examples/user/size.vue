<template>
  <DouUser
    v-for="size in ['sm', 'md', 'lg']"
    :key="size"
    :size="size"
    name="陈晓"
    description="前端工程师"
  />
</template>
