<script setup lang="ts">
import { ArrowLeftIcon } from '@dou-ui/icons'
import { useLocale } from '../config-provider/use-config'
import { useNamespace } from '../../utils/namespace'
import type { PageHeaderEmits, PageHeaderProps, PageHeaderSlots } from './page-header'

defineOptions({ name: 'DouPageHeader' })

withDefaults(defineProps<PageHeaderProps>(), { showBack: true, level: 1 })
const emit = defineEmits<PageHeaderEmits>()
const slots = defineSlots<PageHeaderSlots>()

const ns = useNamespace('page-header')
const { t } = useLocale()
</script>

<template>
  <header :class="ns.b()">
    <div v-if="slots.breadcrumb" :class="ns.e('breadcrumb')">
      <slot name="breadcrumb" />
    </div>
    <div :class="ns.e('main')">
      <div :class="ns.e('heading')">
        <template v-if="showBack">
          <button type="button" :class="ns.e('back')" @click="emit('back', $event)">
            <span :class="ns.e('back-icon')" aria-hidden="true">
              <slot name="icon"><ArrowLeftIcon /></slot>
            </span>
            <span :class="ns.e('back-text')">{{ backText ?? t('pageHeader.back') }}</span>
          </button>
          <span :class="ns.e('divider')" aria-hidden="true" />
        </template>
        <component :is="`h${level}`" :class="ns.e('title')">
          <slot name="title">{{ title }}</slot>
        </component>
        <span v-if="slots.subtitle || subtitle" :class="ns.e('subtitle')">
          <slot name="subtitle">{{ subtitle }}</slot>
        </span>
      </div>
      <div v-if="slots.extra" :class="ns.e('extra')">
        <slot name="extra" />
      </div>
    </div>
    <div v-if="slots.default" :class="ns.e('content')">
      <slot />
    </div>
  </header>
</template>
