<template>
  <DouFieldGroup v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size">
    <DouFieldGroupText>{{ size }}</DouFieldGroupText>
    <DouInput placeholder="输入框" />
    <DouButton variant="outline">按钮</DouButton>
  </DouFieldGroup>
</template>
