<script setup>
import { MinusIcon, PlusIcon } from '@dou-ui/icons'
</script>

<template>
  <DouFieldGroup>
    <DouButton variant="outline">日</DouButton>
    <DouButton variant="outline">周</DouButton>
    <DouButton variant="outline">月</DouButton>
  </DouFieldGroup>
  <DouFieldGroup>
    <DouButton variant="outline">
      <template #leading>
        <MinusIcon />
      </template>
    </DouButton>
    <DouButton variant="outline">
      <template #leading>
        <PlusIcon />
      </template>
    </DouButton>
  </DouFieldGroup>
  <DouFieldGroup>
    <DouButton tone="primary">发布</DouButton>
    <DouButton tone="primary">存为草稿</DouButton>
  </DouFieldGroup>
</template>
