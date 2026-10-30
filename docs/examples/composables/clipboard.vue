<script setup lang="ts">
import { CheckIcon, CopyIcon } from '@dou-ui/icons'
import { useClipboard } from 'dou-ui'

const command = 'bun add dou-ui'
const { copy, copied } = useClipboard()
</script>

<template>
  <div class="clipboard-demo">
    <code>{{ command }}</code>
    <DouButton variant="ghost" size="sm" @click="copy(command)">
      <template #leading>
        <CheckIcon v-if="copied" />
        <CopyIcon v-else />
      </template>
      {{ copied ? '已复制' : '复制命令' }}
    </DouButton>
  </div>
</template>

<style scoped>
.clipboard-demo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 8px 8px 14px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-control);
  font-family: var(--dou-font-family-mono);
  font-size: var(--dou-font-size-sm);
}
</style>
