<script setup>
import { ref } from 'vue'

const birthday = ref('1998-06-15')
const empty = ref(null)
</script>

<template>
  <DouInputDate v-model="birthday" style="width: 160px" />
  <DouInputDate v-model="empty" clearable style="width: 180px" />
  <DouText variant="tertiary" size="sm">{{ birthday }} · {{ empty ?? 'null' }}</DouText>
</template>
