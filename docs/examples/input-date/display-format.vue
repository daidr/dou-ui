<script setup>
import { en } from 'dou-ui'
import { ref } from 'vue'

const date = ref('2026-10-29')
const datetime = ref('2026-10-29 21:05')
</script>

<template>
  <DouInputDate v-model="date" display-format="YYYY[年]MM[月]DD[日]" style="width: 190px" />
  <DouInputDate v-model="date" display-format="DD.MM.YYYY" style="width: 160px" />
  <DouConfigProvider :locale="en">
    <DouInputDate v-model="datetime" type="datetime" style="width: 230px" />
  </DouConfigProvider>
  <DouText variant="tertiary" size="sm">{{ date }} · {{ datetime }}</DouText>
</template>
