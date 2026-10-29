<script setup>
import { CheckCircleIcon, SearchIcon } from '@dou-ui/icons'
</script>

<template>
  <DouText>
    <DouIcon>
      <SearchIcon />
    </DouIcon>
    搜索
  </DouText>
  <DouText tone="success">
    <DouIcon>
      <CheckCircleIcon />
    </DouIcon>
    已通过
  </DouText>
</template>
