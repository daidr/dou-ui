<script setup>
import { CheckCircleIcon, SearchIcon, TrashIcon } from '@dou-ui/icons'
</script>

<template>
  <DouText><SearchIcon /> 默认 1em，跟随字号</DouText>
  <SearchIcon :size="20" />
  <SearchIcon :size="24" />
  <SearchIcon :size="32" :stroke-width="1.25" />
  <DouText tone="success"><CheckCircleIcon :size="20" /></DouText>
  <DouText tone="danger"><TrashIcon :size="20" /></DouText>
</template>
