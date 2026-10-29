<script setup>
import { ref } from 'vue'

const trip = ref(['2026-11-02', '2026-11-06'])
</script>

<template>
  <DouInputDate v-model="trip" range picker clearable style="width: 300px" />
  <DouText variant="tertiary" size="sm">{{ trip ?? 'null' }}</DouText>
</template>
