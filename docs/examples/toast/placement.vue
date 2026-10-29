<script setup>
import { toast } from 'dou-ui'
</script>

<template>
  <DouButton
    v-for="placement in ['top-left', 'top-right', 'bottom-left', 'bottom', 'bottom-right']"
    :key="placement"
    variant="outline"
    size="sm"
    @click="toast(placement, { placement })"
  >
    {{ placement }}
  </DouButton>
</template>
