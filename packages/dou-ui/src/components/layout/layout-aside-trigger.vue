<script setup lang="ts">
import { MenuIcon } from '@dou-ui/icons'
import { inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouButton } from '../button'
import { useLocale } from '../config-provider/use-config'
import { layoutKey } from './layout'
import type { LayoutAsideTriggerProps } from './layout'

defineOptions({ name: 'DouLayoutAsideTrigger' })

defineProps<LayoutAsideTriggerProps>()

const ns = useNamespace('layout-aside-trigger')
const { t } = useLocale()
const layout = inject(layoutKey, null)
</script>

<template>
  <DouButton
    v-if="layout?.drawer.value"
    :class="ns.b()"
    variant="ghost"
    :size="size"
    :aria-label="t('layout.open')"
    aria-haspopup="dialog"
    :aria-expanded="layout.drawer.value.open.value"
    :aria-controls="layout.drawer.value.id"
    @click="layout.drawer.value.open.value = !layout.drawer.value.open.value"
  >
    <template #leading><MenuIcon /></template>
  </DouButton>
</template>
