<script setup>
import { MoreHorizontalIcon } from '@dou-ui/icons'
</script>

<template>
  <DouUser
    name="DouUI"
    description="组织 · 12 名成员"
    :avatar="{ shape: 'square' }"
    style="width: 100%"
  >
    <DouButton variant="ghost" size="sm" aria-label="更多">
      <template #leading>
        <MoreHorizontalIcon />
      </template>
    </DouButton>
  </DouUser>
  <DouUser name="戴兜" style="width: 100%">
    <template #description>
      <DouLink href="#">@daidr</DouLink>
    </template>
  </DouUser>
</template>
