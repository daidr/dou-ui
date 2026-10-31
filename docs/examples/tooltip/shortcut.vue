<script setup lang="ts">
import { RedoIcon, UndoIcon } from '@dou-ui/icons'
</script>

<template>
  <DouTooltip content="撤销" shortcut="mod+z">
    <DouButton variant="outline" aria-label="撤销"><UndoIcon /></DouButton>
  </DouTooltip>
  <DouTooltip content="重做" shortcut="mod+shift+z">
    <DouButton variant="outline" aria-label="重做"><RedoIcon /></DouButton>
  </DouTooltip>
</template>
